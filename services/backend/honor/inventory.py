import json
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert

from .models import (
    Audit,
    Balance,
    Command,
    Location,
    Movement,
    Order,
    OrderLine,
    Outbox,
    Product,
    SerialUnit,
    Transfer,
    now,
    uid,
)
from .security import aware, digest


def scoped(db, cls, company_id, record_id, lock=False):
    query = select(cls).where(cls.company_id == company_id, cls.id == record_id)
    record = db.scalar(query.with_for_update().execution_options(populate_existing=True) if lock else query)
    if not record:
        raise HTTPException(404, "Record not found")
    return record


def balance(db, company_id, product_id, location_id):
    db.execute(
        insert(Balance)
        .values(company_id=company_id, product_id=product_id, location_id=location_id, on_hand=0, reserved=0)
        .on_conflict_do_nothing()
    )
    return db.scalar(
        select(Balance)
        .where(
            Balance.company_id == company_id,
            Balance.product_id == product_id,
            Balance.location_id == location_id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def audit(db, company_id, actor, action, **details):
    db.add(Audit(company_id=company_id, actor_id=actor, action=action, details=details))


def movement(db, company_id, actor, product_id, location_id, delta, kind, reference, reason=""):
    db.add(
        Movement(
            company_id=company_id,
            actor_id=actor,
            product_id=product_id,
            location_id=location_id,
            delta=delta,
            kind=kind,
            reference=reference,
            reason=reason,
        )
    )


def command(db, company_id, actor, key, action, payload, operation):
    if not key or not 16 <= len(key) <= 128:
        raise HTTPException(422, "Supply an Idempotency-Key of 16–128 characters")
    fingerprint = digest(json.dumps({"actor": actor, "action": action, "payload": payload}, sort_keys=True))
    db.execute(
        insert(Command)
        .values(company_id=company_id, key=key, fingerprint=fingerprint)
        .on_conflict_do_nothing()
    )
    saved = db.scalar(
        select(Command)
        .where(Command.company_id == company_id, Command.key == key)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if saved.fingerprint != fingerprint:
        raise HTTPException(409, "This command key was already used for another request")
    if saved.result is not None:
        result = saved.result
    else:
        result = operation()
        saved.result = result
    db.commit()
    return result


def serial_selection(db, product, location_id, serials, quantity, *, status="AVAILABLE", order_id=None):
    if product.tracking == "QUANTITY":
        if serials:
            raise HTTPException(422, "Quantity-tracked items do not accept serials")
        return []
    if len(serials) != quantity or len(set(serials)) != len(serials):
        raise HTTPException(422, "Supply one unique serial for each device")
    units = list(
        db.scalars(
            select(SerialUnit)
            .where(
                SerialUnit.company_id == product.company_id,
                SerialUnit.product_id == product.id,
                SerialUnit.location_id == location_id,
                SerialUnit.serial.in_(serials),
                SerialUnit.status == status,
                SerialUnit.order_id == order_id,
            )
            .order_by(SerialUnit.id)
            .with_for_update()
        )
    )
    if len(units) != quantity:
        raise HTTPException(409, "One or more serials are unavailable at this location")
    return units


def receive(db, scope, data, key):
    scope.require("ADMIN", "MANAGER", "STOCK")
    scope.location(data.location_id)
    product = scoped(db, Product, scope.company_id, data.product_id)
    scoped(db, Location, scope.company_id, data.location_id)

    def apply():
        if product.tracking == "SERIAL":
            if len(data.serials) != data.quantity or len(set(data.serials)) != data.quantity:
                raise HTTPException(422, "Supply one unique serial for each received device")
        elif data.serials:
            raise HTTPException(422, "Quantity-tracked items do not accept serials")
        stock = balance(db, scope.company_id, product.id, data.location_id)
        stock.on_hand += data.quantity
        for serial in data.serials:
            db.add(
                SerialUnit(
                    company_id=scope.company_id,
                    product_id=product.id,
                    location_id=data.location_id,
                    serial=serial,
                )
            )
        movement(
            db,
            scope.company_id,
            scope.user.id,
            product.id,
            data.location_id,
            data.quantity,
            "RECEIPT",
            key,
            data.reason,
        )
        audit(
            db,
            scope.company_id,
            scope.user.id,
            "stock.received",
            product_id=product.id,
            quantity=data.quantity,
        )
        db.flush()
        return {"status": "POSTED", "on_hand": stock.on_hand, "reserved": stock.reserved}

    return command(db, scope.company_id, scope.user.id, key, "receipt", data.model_dump(), apply)


def adjust(db, scope, data, key):
    scope.require("ADMIN", "MANAGER")
    scope.location(data.location_id)
    product = scoped(db, Product, scope.company_id, data.product_id)
    scoped(db, Location, scope.company_id, data.location_id)
    if product.tracking == "SERIAL":
        raise HTTPException(422, "Use receipt, sale or inspected return for serial-tracked stock")

    def apply():
        stock = balance(db, scope.company_id, product.id, data.location_id)
        if stock.on_hand + data.delta < stock.reserved:
            raise HTTPException(409, "Adjustment would consume reserved stock or make stock negative")
        stock.on_hand += data.delta
        movement(
            db,
            scope.company_id,
            scope.user.id,
            product.id,
            data.location_id,
            data.delta,
            "ADJUSTMENT",
            key,
            data.reason,
        )
        audit(
            db,
            scope.company_id,
            scope.user.id,
            "stock.adjusted",
            product_id=product.id,
            delta=data.delta,
            reason=data.reason,
        )
        return {"status": "POSTED", "on_hand": stock.on_hand}

    return command(db, scope.company_id, scope.user.id, key, "adjustment", data.model_dump(), apply)


def dispatch(db, scope, data, key):
    scope.require("ADMIN", "MANAGER", "STOCK")
    scope.location(data.location_id)
    product = scoped(db, Product, scope.company_id, data.product_id)
    scoped(db, Location, scope.company_id, data.location_id)
    scoped(db, Location, scope.company_id, data.destination_id)
    if data.destination_id == data.location_id:
        raise HTTPException(422, "Choose a different destination")

    def apply():
        stock = balance(db, scope.company_id, product.id, data.location_id)
        if stock.on_hand - stock.reserved < data.quantity:
            raise HTTPException(409, "Insufficient available stock")
        units = serial_selection(db, product, data.location_id, data.serials, data.quantity)
        transfer = Transfer(
            id=uid(),
            company_id=scope.company_id,
            product_id=product.id,
            source_id=data.location_id,
            destination_id=data.destination_id,
            quantity=data.quantity,
            serial_ids=[x.id for x in units],
            reason=data.reason,
        )
        db.add(transfer)
        stock.on_hand -= data.quantity
        for unit in units:
            unit.status = "IN_TRANSIT"
        movement(
            db,
            scope.company_id,
            scope.user.id,
            product.id,
            data.location_id,
            -data.quantity,
            "TRANSFER_OUT",
            transfer.id,
            data.reason,
        )
        audit(db, scope.company_id, scope.user.id, "transfer.dispatched", transfer_id=transfer.id)
        return {"id": transfer.id, "status": "DISPATCHED"}

    return command(db, scope.company_id, scope.user.id, key, "transfer.dispatch", data.model_dump(), apply)


def receive_transfer(db, scope, transfer_id, key):
    scope.require("ADMIN", "MANAGER", "STOCK")

    def apply():
        transfer = scoped(db, Transfer, scope.company_id, transfer_id, lock=True)
        scope.location(transfer.destination_id)
        if transfer.status != "DISPATCHED":
            raise HTTPException(409, "Transfer is already received")
        stock = balance(db, scope.company_id, transfer.product_id, transfer.destination_id)
        stock.on_hand += transfer.quantity
        if transfer.serial_ids:
            units = list(
                db.scalars(
                    select(SerialUnit)
                    .where(
                        SerialUnit.company_id == scope.company_id,
                        SerialUnit.id.in_(transfer.serial_ids),
                        SerialUnit.status == "IN_TRANSIT",
                    )
                    .with_for_update()
                )
            )
            if len(units) != transfer.quantity:
                raise HTTPException(409, "Transfer serials require investigation")
            for unit in units:
                unit.location_id, unit.status = transfer.destination_id, "AVAILABLE"
        transfer.status = "RECEIVED"
        movement(
            db,
            scope.company_id,
            scope.user.id,
            transfer.product_id,
            transfer.destination_id,
            transfer.quantity,
            "TRANSFER_IN",
            transfer.id,
            transfer.reason,
        )
        audit(db, scope.company_id, scope.user.id, "transfer.received", transfer_id=transfer.id)
        return {"id": transfer.id, "status": transfer.status}

    return command(db, scope.company_id, scope.user.id, key, "transfer.receive", {"id": transfer_id}, apply)


def lines(db, order):
    return list(
        db.scalars(select(OrderLine).where(OrderLine.order_id == order.id).order_by(OrderLine.product_id))
    )


def release(db, order, new_status):
    for line in lines(db, order):
        stock = balance(db, order.company_id, line.product_id, order.location_id)
        stock.reserved -= line.quantity
    for unit in db.scalars(
        select(SerialUnit)
        .where(
            SerialUnit.company_id == order.company_id,
            SerialUnit.order_id == order.id,
            SerialUnit.status == "RESERVED",
        )
        .with_for_update()
    ):
        unit.status, unit.order_id = "AVAILABLE", None
    order.status = new_status


def expire(db, company_id=None):
    query = select(Order).where(Order.status == "RESERVED", Order.expires_at <= now()).order_by(Order.id)
    if company_id:
        query = query.where(Order.company_id == company_id)
    for order in db.scalars(query.with_for_update(skip_locked=True)):
        release(db, order, "EXPIRED")


def reserve(db, company, data, key, settings, customer_id=None):
    # Expire in a separate transaction before acquiring a new order's stock locks.
    expire(db, company.id)
    db.commit()
    wanted = sorted(data.lines, key=lambda line: line.product_id)

    def apply():
        products = {
            line.product_id: scoped(db, Product, company.id, line.product_id, lock=True)
            for line in wanted
        }
        if any(not p.published for p in products.values()):
            raise HTTPException(404, "Product is not available in this shop")
        total = sum(products[line.product_id].price_minor * line.quantity for line in wanted)
        if data.expected_total_minor is not None and total != data.expected_total_minor:
            raise HTTPException(409, "Prices have changed. Review the updated cart before paying.")
        locations = list(
            db.scalars(
                select(Location)
                .where(Location.company_id == company.id, Location.fulfil_online.is_(True))
                .order_by(Location.id)
            )
        )
        chosen = None
        for location in locations:
            stocks = [balance(db, company.id, line.product_id, location.id) for line in wanted]
            if all(stock.on_hand - stock.reserved >= line.quantity for stock, line in zip(stocks, wanted)):
                chosen = (location, stocks)
                break
        if not chosen:
            raise HTTPException(
                409, "These items are not all available from one fulfilment location. Refresh your cart."
            )
        location, stocks = chosen
        if total > 2_000_000_000 or total <= 0:
            raise HTTPException(422, "Order total is outside supported checkout limits")
        order = Order(
            id=uid(),
            company_id=company.id,
            customer_id=customer_id,
            location_id=location.id,
            customer_name=data.customer_name,
            email=data.email.lower(),
            access_hash=digest(data.client_token),
            total_minor=total,
            currency=company.currency,
            seller_name=company.name,
            expires_at=now() + timedelta(minutes=settings.reservation_minutes),
        )
        db.add(order)
        db.flush()
        for stock, line in zip(stocks, wanted):
            product = products[line.product_id]
            if product.tracking == "SERIAL":
                units = list(
                    db.scalars(
                        select(SerialUnit)
                        .where(
                            SerialUnit.company_id == company.id,
                            SerialUnit.product_id == product.id,
                            SerialUnit.location_id == location.id,
                            SerialUnit.status == "AVAILABLE",
                        )
                        .order_by(SerialUnit.id)
                        .limit(line.quantity)
                        .with_for_update()
                    )
                )
                if len(units) != line.quantity:
                    raise HTTPException(409, "Serial inventory needs reconciliation")
                for unit in units:
                    unit.status, unit.order_id = "RESERVED", order.id
            stock.reserved += line.quantity
            db.add(
                OrderLine(
                    order_id=order.id,
                    company_id=company.id,
                    product_id=product.id,
                    name=product.name,
                    quantity=line.quantity,
                    price_minor=product.price_minor,
                    sku=product.sku,
                    tracking=product.tracking,
                )
            )
        audit(db, company.id, "customer", "order.reserved", order_id=order.id)
        return {
            "id": order.id,
            "status": "RESERVED",
            "payment_status": "UNPAID",
            "total_minor": total,
            "currency": order.currency,
            "expires_at": order.expires_at.isoformat(),
        }

    return command(
        db,
        company.id,
        digest(data.client_token),
        key,
        "checkout",
        {**data.model_dump(), "customer_id": customer_id},
        apply,
    )


def confirm_payment(db, order, provider_reference):
    if order.payment_status in {"PAID", "REFUND_REQUIRED", "REFUNDED"}:
        return
    order.paid_at = now()
    if order.status == "RESERVED" and aware(order.expires_at) <= now():
        release(db, order, "EXPIRED")
        db.flush()
    if order.status == "EXPIRED":
        wanted = lines(db, order)
        stocks = [balance(db, order.company_id, line.product_id, order.location_id) for line in wanted]
        available = all(s.on_hand - s.reserved >= line.quantity for s, line in zip(stocks, wanted))
        selected = []
        for line in wanted:
            product = db.get(Product, line.product_id)
            if product.tracking == "SERIAL":
                units = list(
                    db.scalars(
                        select(SerialUnit)
                        .where(
                            SerialUnit.company_id == order.company_id,
                            SerialUnit.product_id == product.id,
                            SerialUnit.location_id == order.location_id,
                            SerialUnit.status == "AVAILABLE",
                        )
                        .order_by(SerialUnit.id)
                        .limit(line.quantity)
                        .with_for_update()
                    )
                )
                available = available and len(units) == line.quantity
                selected.extend(units)
        if available:
            for stock, line in zip(stocks, wanted):
                stock.reserved += line.quantity
            for unit in selected:
                unit.status, unit.order_id = "RESERVED", order.id
            order.status = "PAID"
        else:
            order.status, order.payment_status = "EXCEPTION", "REFUND_REQUIRED"
    elif order.status == "RESERVED":
        order.status = "PAID"
    else:
        order.status, order.payment_status = "EXCEPTION", "REFUND_REQUIRED"
    if order.payment_status != "REFUND_REQUIRED":
        order.payment_status = "PAID"
    audit(
        db,
        order.company_id,
        "payment-provider",
        "payment.confirmed",
        order_id=order.id,
        reference=provider_reference,
    )
    db.add(Outbox(company_id=order.company_id, kind="ORDER_EMAIL", payload={"order_id": order.id}))


def fulfil(db, scope, order_id, key, data):
    scope.require("ADMIN", "MANAGER", "STOCK", "SALES")

    def apply():
        order = scoped(db, Order, scope.company_id, order_id, lock=True)
        scope.location(order.location_id)
        if order.status != "PAID" or order.payment_status != "PAID":
            raise HTTPException(409, "Only a paid, allocated order can be fulfilled")
        wanted = lines(db, order)
        scans = {x.product_id: x.serials for x in data.devices}
        serial_lines = {x.product_id: x for x in wanted if x.tracking == "SERIAL"}
        if set(scans) != set(serial_lines) or any(
            len(scans[pid]) != line.quantity for pid, line in serial_lines.items()
        ):
            raise HTTPException(422, "Scan the exact serial / IMEI of every device being handed over")
        # Stock locks precede serial locks, matching checkout and transfer lock order.
        stocks = {
            x.product_id: balance(db, order.company_id, x.product_id, order.location_id) for x in wanted
        }
        submitted = [serial for values in scans.values() for serial in values]
        if len(set(submitted)) != len(submitted):
            raise HTTPException(422, "A device cannot appear twice in one handover")
        units = list(
            db.scalars(
                select(SerialUnit)
                .where(
                    SerialUnit.company_id == order.company_id,
                    SerialUnit.location_id == order.location_id,
                    or_(SerialUnit.order_id == order.id, SerialUnit.serial.in_(submitted)),
                )
                .order_by(SerialUnit.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        )
        by_serial = {x.serial: x for x in units}
        for pid, values in scans.items():
            for serial in values:
                unit = by_serial.get(serial)
                if (
                    not unit
                    or unit.product_id != pid
                    or unit.location_id != order.location_id
                    or not (
                        (unit.status == "RESERVED" and unit.order_id == order.id)
                        or (unit.status == "AVAILABLE" and unit.order_id is None)
                    )
                ):
                    raise HTTPException(
                        409,
                        "A scanned device is unavailable, reserved for another order, or at another location",
                    )
        for unit in units:
            if unit.order_id == order.id and unit.status == "RESERVED":
                unit.status, unit.order_id = "AVAILABLE", None
        for pid, values in scans.items():
            serial_lines[pid].serials = list(values)  # Immutable sale snapshot; returns never rewrite it.
            for serial in values:
                by_serial[serial].status, by_serial[serial].order_id = "SOLD", order.id
        for line in wanted:
            stock = stocks[line.product_id]
            stock.reserved -= line.quantity
            stock.on_hand -= line.quantity
            movement(
                db,
                order.company_id,
                scope.user.id,
                line.product_id,
                order.location_id,
                -line.quantity,
                "SALE",
                order.id,
            )
        order.status = "FULFILLED"
        order.fulfilled_at = now()
        audit(db, order.company_id, scope.user.id, "order.fulfilled", order_id=order.id)
        db.add(Outbox(company_id=order.company_id, kind="ORDER_EMAIL", payload={"order_id": order.id}))
        return {"id": order.id, "status": "FULFILLED"}

    return command(
        db, scope.company_id, scope.user.id, key, "order.fulfil", {"id": order_id, **data.model_dump()}, apply
    )


def inspected_return(db, scope, order_id, data, key):
    scope.require("ADMIN", "MANAGER")

    def apply():
        order = scoped(db, Order, scope.company_id, order_id, lock=True)
        scope.location(data.location_id)
        if data.location_id != order.location_id or order.status != "FULFILLED":
            raise HTTPException(409, "Return must reference a fulfilled sale at its original location")
        line = db.get(OrderLine, (order.id, data.product_id))
        if not line or data.quantity > line.quantity - line.returned_quantity:
            raise HTTPException(409, "Return exceeds the unreturned sale quantity")
        product = scoped(db, Product, scope.company_id, data.product_id)
        stock = balance(db, scope.company_id, product.id, data.location_id)
        units = serial_selection(
            db, product, data.location_id, data.serials, data.quantity, status="SOLD", order_id=order.id
        )
        line.returned_quantity += data.quantity
        if data.restock:
            stock.on_hand += data.quantity
            movement(
                db,
                scope.company_id,
                scope.user.id,
                product.id,
                data.location_id,
                data.quantity,
                "RETURN",
                order.id,
                data.reason,
            )
        for unit in units:
            unit.status = "AVAILABLE" if data.restock else "QUARANTINE"
            unit.order_id = None
        audit(
            db,
            scope.company_id,
            scope.user.id,
            "return.inspected",
            order_id=order.id,
            product_id=product.id,
            quantity=data.quantity,
            restock=data.restock,
            reason=data.reason,
        )
        return {
            "status": "RETURN_RECORDED",
            "returned_quantity": line.returned_quantity,
            "refund_status": "SEPARATE_PROVIDER_WORKFLOW",
        }

    return command(
        db,
        scope.company_id,
        scope.user.id,
        key,
        "order.return",
        {"order": order_id, **data.model_dump()},
        apply,
    )
