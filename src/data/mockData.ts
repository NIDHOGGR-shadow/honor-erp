/**
 * Honor — Initial Normative Data
 * Branches: Computer Village Ikeja, Victoria Island, Alaba Warehouse
 */

import {
  Location,
  Staff,
  Product,
  Variant,
  StockUnit,
  StockLevel,
  StockMovement,
  Sale,
  Purchase,
  Transfer,
  Customer,
  Supplier,
  NotificationItem,
  AuditLogEntry,
} from "../types";

export const INITIAL_LOCATIONS: Location[] = [
  {
    id: "loc-ikeja",
    name: "Ikeja Branch (Computer Village)",
    code: "IKJ",
    type: "BRANCH",
    address: "14 Otigba Street, Computer Village, Ikeja, Lagos",
    phone: "+234 803 219 4410",
    isWarehouse: false,
  },
  {
    id: "loc-vi",
    name: "Victoria Island Branch",
    code: "VI",
    type: "BRANCH",
    address: "Plot 12 Ahmadu Bello Way, Victoria Island, Lagos",
    phone: "+234 812 400 9981",
    isWarehouse: false,
  },
  {
    id: "loc-wh",
    name: "Alaba Central Warehouse",
    code: "WH-ALB",
    type: "WAREHOUSE",
    address: "Line 4, International Electronics Section, Alaba Market, Lagos",
    phone: "+234 809 111 2233",
    isWarehouse: true, // Warehouse cannot sell directly!
  },
];

export const INITIAL_STAFF: Staff[] = [
  {
    id: "staff-owner",
    name: "Onoja Michael",
    email: "onoja@example.test",
    phone: "08030001122",
    role: "OWNER",
    assignedLocationIds: ["*"],
    pin: "9988",
    status: "ACTIVE",
    salesTarget: 10000000,
    totalSales: 8450000,
  },
  {
    id: "staff-mgr-ikeja",
    name: "Chioma Adeyemi",
    email: "chioma@example.test",
    phone: "08023334455",
    role: "MANAGER",
    assignedLocationIds: ["loc-ikeja", "loc-wh"],
    pin: "1234", // Standard Manager PIN for elevations
    status: "ACTIVE",
    salesTarget: 5000000,
    totalSales: 4200000,
  },
  {
    id: "staff-sales-1",
    name: "Babatunde Lawal",
    email: "tunde@example.test",
    phone: "08169998877",
    role: "SALES",
    assignedLocationIds: ["loc-ikeja"],
    pin: "0000",
    status: "ACTIVE",
    salesTarget: 3000000,
    totalSales: 2750000,
  },
  {
    id: "staff-inv-1",
    name: "Emeka Nnamdi",
    email: "emeka@example.test",
    phone: "08071112233",
    role: "INVENTORY",
    assignedLocationIds: ["loc-ikeja", "loc-wh"],
    pin: "4321",
    status: "ACTIVE",
  },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: "sup-redington",
    name: "Redington Gulf Nigeria",
    contactPerson: "Kunal Varma",
    phone: "+234 802 998 8776",
    email: "orders.ng@redingtongroup.com",
    address: "Plot 5 Commercial Avenue, Ilupeju, Lagos",
    bankDetails: "Access Bank · 0012398471 · Redington Nig Ltd",
    balance: 1450000,
    purchasesCount: 18,
    totalPurchased: 45200000,
    createdAt: "2025-01-10T09:00:00Z",
  },
  {
    id: "sup-td",
    name: "TD Africa Distribution",
    contactPerson: "Folake Adeleke",
    phone: "+234 803 445 6677",
    email: "telecomms@tdafrica.com",
    address: "Yudala Heights, 13 Idowu Martins St, Victoria Island, Lagos",
    bankDetails: "Zenith Bank · 1014589201 · Technology Dist Nig",
    balance: 0,
    purchasesCount: 12,
    totalPurchased: 31800000,
    createdAt: "2025-02-14T11:30:00Z",
  },
  {
    id: "sup-mitsumi",
    name: "Mitsumi Distribution Lagos",
    contactPerson: "Ahmed Bello",
    phone: "+234 812 334 5566",
    email: "lagos.sales@mitsumidistribution.com",
    address: "Oregun Industrial Estate, Ikeja, Lagos",
    bankDetails: "First Bank · 2039485712 · Mitsumi Nig",
    balance: 850000,
    purchasesCount: 9,
    totalPurchased: 19400000,
    createdAt: "2025-03-01T08:15:00Z",
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-ip15pm",
    name: "Apple iPhone 15 Pro Max",
    brand: "Apple",
    model: "iPhone 15 Pro Max",
    category: "Smartphones",
    trackingType: "SERIALISED", // Serialised device!
    description:
      "Titanium design with A17 Pro chip, 48MP camera system, Action button, USB-C.",
    createdAt: "2025-09-01T10:00:00Z",
  },
  {
    id: "prod-s24u",
    name: "Samsung Galaxy S24 Ultra 5G",
    brand: "Samsung",
    model: "Galaxy S24 Ultra",
    category: "Smartphones",
    trackingType: "SERIALISED",
    description:
      "Galaxy AI, built-in S Pen, Snapdragon 8 Gen 3 for Galaxy, 200MP camera.",
    createdAt: "2025-09-02T10:00:00Z",
  },
  {
    id: "prod-mbp14",
    name: "MacBook Pro 14-inch M3 Pro",
    brand: "Apple",
    model: "MacBook Pro 14 (Late 2023)",
    category: "Laptops & MacBooks",
    trackingType: "SERIALISED",
    description:
      "Apple M3 Pro 11-core CPU, 14-core GPU, Liquid Retina XDR display.",
    createdAt: "2025-09-05T12:00:00Z",
  },
  {
    id: "prod-ip13",
    name: "Apple iPhone 13",
    brand: "Apple",
    model: "iPhone 13",
    category: "Smartphones",
    trackingType: "SERIALISED",
    description: "A15 Bionic chip, Dual 12MP camera, Super Retina XDR OLED.",
    createdAt: "2025-09-10T14:00:00Z",
  },
  {
    id: "prod-charger-20w",
    name: "Apple 20W USB-C Power Adapter",
    brand: "Apple",
    model: "MHJE3ZM/A",
    category: "Power & Charging",
    trackingType: "QUANTITY", // Quantity-based accessory!
    description: "Original Apple 20W fast charging plug for iPhone and iPad.",
    createdAt: "2025-09-12T09:00:00Z",
  },
  {
    id: "prod-freepods4",
    name: "Oraimo FreePods 4 ANC TWS",
    brand: "Oraimo",
    model: "OEB-E105D",
    category: "Audio & Wearables",
    trackingType: "QUANTITY",
    description:
      "Active Noise Cancellation, 35.5-hr playtime, low-latency gaming mode.",
    createdAt: "2025-09-15T11:00:00Z",
  },
  {
    id: "prod-anker-20k",
    name: "Anker 325 Power Bank 20,000mAh",
    brand: "Anker",
    model: "A1286",
    category: "Power & Charging",
    trackingType: "QUANTITY",
    description:
      "High-capacity 20,000mAh external battery pack with PowerIQ technology.",
    createdAt: "2025-09-16T15:00:00Z",
  },
];

export const INITIAL_VARIANTS: Variant[] = [
  // iPhone 15 Pro Max
  {
    id: "var-ip15pm-256-nt",
    productId: "prod-ip15pm",
    name: "iPhone 15 Pro Max 256GB - Natural Titanium",
    sku: "APL-15PM-256-NT",
    colour: "Natural Titanium",
    storage: "256GB",
    ram: "8GB",
    costPrice: 1720000,
    sellingPrice: 1950000, // VAT-inclusive 7.5%
    barcode: "195949038221",
  },
  {
    id: "var-ip15pm-512-bt",
    productId: "prod-ip15pm",
    name: "iPhone 15 Pro Max 512GB - Blue Titanium",
    sku: "APL-15PM-512-BT",
    colour: "Blue Titanium",
    storage: "512GB",
    ram: "8GB",
    costPrice: 1980000,
    sellingPrice: 2280000,
    barcode: "195949038238",
  },
  // Galaxy S24 Ultra
  {
    id: "var-s24u-512-tg",
    productId: "prod-s24u",
    name: "Samsung S24 Ultra 512GB - Titanium Gray",
    sku: "SAM-S24U-512-TG",
    colour: "Titanium Gray",
    storage: "512GB",
    ram: "12GB",
    costPrice: 1650000,
    sellingPrice: 1880000,
    barcode: "880609530491",
  },
  // MacBook Pro 14
  {
    id: "var-mbp14-512-sg",
    productId: "prod-mbp14",
    name: 'MacBook Pro 14" M3 Pro 18GB / 512GB - Space Black',
    sku: "APL-MBP14-M3P-SB",
    colour: "Space Black",
    storage: "512GB SSD",
    ram: "18GB Unified",
    costPrice: 2850000,
    sellingPrice: 3250000,
    barcode: "195949112990",
  },
  // iPhone 13
  {
    id: "var-ip13-128-mdn",
    productId: "prod-ip13",
    name: "iPhone 13 128GB - Midnight",
    sku: "APL-13-128-MDN",
    colour: "Midnight",
    storage: "128GB",
    ram: "4GB",
    costPrice: 710000,
    sellingPrice: 820000,
    barcode: "194252707241",
  },
  // Accessories
  {
    id: "var-charger-20w",
    productId: "prod-charger-20w",
    name: "Apple 20W Power Adapter (UK 3-Pin)",
    sku: "ACC-APL-20W-UK",
    costPrice: 19000,
    sellingPrice: 28000,
    barcode: "194252157008",
  },
  {
    id: "var-freepods4-blk",
    productId: "prod-freepods4",
    name: "Oraimo FreePods 4 - Black",
    sku: "ACC-ORM-FP4-BLK",
    colour: "Black",
    costPrice: 26000,
    sellingPrice: 38000,
    barcode: "489518078942",
  },
  {
    id: "var-anker-20k",
    productId: "prod-anker-20k",
    name: "Anker 325 Power Bank 20,000mAh - Black",
    sku: "ACC-ANK-325-20K",
    colour: "Black",
    costPrice: 32000,
    sellingPrice: 48000,
    barcode: "194644023194",
  },
];

export const INITIAL_STOCK_UNITS: StockUnit[] = [
  // iPhone 15 Pro Max 256GB - In Stock at Ikeja
  {
    id: "unit-001",
    variantId: "var-ip15pm-256-nt",
    imei1: "358291104829104",
    imei2: "358291104829112",
    serialNumber: "K7H9WX2Q0L",
    costPrice: 1720000,
    condition: "BRAND_NEW",
    status: "IN_STOCK",
    locationId: "loc-ikeja",
    supplierId: "sup-redington",
    receivedDate: "2026-08-15T10:30:00Z",
  },
  {
    id: "unit-002",
    variantId: "var-ip15pm-256-nt",
    imei1: "358291104829120",
    imei2: "358291104829138",
    serialNumber: "K7H9WX2Q1M",
    costPrice: 1720000,
    condition: "BRAND_NEW",
    status: "IN_STOCK",
    locationId: "loc-ikeja",
    supplierId: "sup-redington",
    receivedDate: "2026-08-15T10:30:00Z",
  },
  {
    id: "unit-003",
    variantId: "var-ip15pm-256-nt",
    imei1: "358291104829146",
    imei2: "358291104829153",
    serialNumber: "K7H9WX2Q2N",
    costPrice: 1720000,
    condition: "BRAND_NEW",
    status: "IN_STOCK",
    locationId: "loc-vi",
    supplierId: "sup-redington",
    receivedDate: "2026-08-20T14:00:00Z",
  },
  // In transit to VI
  {
    id: "unit-004",
    variantId: "var-ip15pm-512-bt",
    imei1: "358291104991023",
    imei2: "358291104991031",
    serialNumber: "P8J2MN4R9T",
    costPrice: 1980000,
    condition: "BRAND_NEW",
    status: "IN_TRANSIT",
    locationId: "loc-wh",
    supplierId: "sup-redington",
    receivedDate: "2026-08-28T09:15:00Z",
  },
  // Samsung S24 Ultra - Ikeja
  {
    id: "unit-005",
    variantId: "var-s24u-512-tg",
    imei1: "352940118274019",
    imei2: "352940118274027",
    serialNumber: "RF8N304K2LM",
    costPrice: 1650000,
    condition: "BRAND_NEW",
    status: "IN_STOCK",
    locationId: "loc-ikeja",
    supplierId: "sup-td",
    receivedDate: "2026-08-10T11:00:00Z",
  },
  {
    id: "unit-006",
    variantId: "var-s24u-512-tg",
    imei1: "352940118274035",
    imei2: "352940118274043",
    serialNumber: "RF8N304K3NP",
    costPrice: 1650000,
    condition: "OPEN_BOX",
    status: "IN_STOCK",
    locationId: "loc-ikeja",
    supplierId: "sup-td",
    receivedDate: "2026-08-10T11:00:00Z",
  },
  // MacBook Pro 14 - Ikeja
  {
    id: "unit-007",
    variantId: "var-mbp14-512-sg",
    imei1: "990001827364512", // Serialised Mac hardware identifier
    serialNumber: "C02GK089MD6R",
    costPrice: 2850000,
    condition: "BRAND_NEW",
    status: "IN_STOCK",
    locationId: "loc-ikeja",
    supplierId: "sup-redington",
    receivedDate: "2026-08-18T16:20:00Z",
  },
  // Sold unit (for customer device tracking)
  {
    id: "unit-008",
    variantId: "var-ip13-128-mdn",
    imei1: "359401103849102",
    imei2: "359401103849110",
    serialNumber: "F2L8Z019KM",
    costPrice: 710000,
    condition: "REFURBISHED",
    status: "SOLD",
    locationId: "loc-ikeja",
    supplierId: "sup-mitsumi",
    customerId: "cust-001",
    saleId: "sale-001",
    warrantyEndDate: "2027-09-02T16:00:00Z",
    receivedDate: "2026-08-01T09:00:00Z",
  },
];

export const INITIAL_STOCK_LEVELS: StockLevel[] = [
  // Ikeja Branch
  {
    id: "sl-1",
    variantId: "var-ip15pm-256-nt",
    locationId: "loc-ikeja",
    onHand: 2,
    reserved: 0,
    reorderLevel: 2,
  },
  {
    id: "sl-2",
    variantId: "var-ip15pm-512-bt",
    locationId: "loc-ikeja",
    onHand: 0,
    reserved: 0,
    reorderLevel: 1,
  },
  {
    id: "sl-3",
    variantId: "var-s24u-512-tg",
    locationId: "loc-ikeja",
    onHand: 2,
    reserved: 0,
    reorderLevel: 2,
  },
  {
    id: "sl-4",
    variantId: "var-mbp14-512-sg",
    locationId: "loc-ikeja",
    onHand: 1,
    reserved: 0,
    reorderLevel: 1,
  },
  {
    id: "sl-5",
    variantId: "var-ip13-128-mdn",
    locationId: "loc-ikeja",
    onHand: 0,
    reserved: 0,
    reorderLevel: 2,
  },
  {
    id: "sl-6",
    variantId: "var-charger-20w",
    locationId: "loc-ikeja",
    onHand: 42,
    reserved: 0,
    reorderLevel: 10,
  },
  {
    id: "sl-7",
    variantId: "var-freepods4-blk",
    locationId: "loc-ikeja",
    onHand: 15,
    reserved: 0,
    reorderLevel: 5,
  },
  {
    id: "sl-8",
    variantId: "var-anker-20k",
    locationId: "loc-ikeja",
    onHand: 8,
    reserved: 0,
    reorderLevel: 3,
  },

  // Victoria Island Branch
  {
    id: "sl-9",
    variantId: "var-ip15pm-256-nt",
    locationId: "loc-vi",
    onHand: 1,
    reserved: 0,
    reorderLevel: 2,
  },
  {
    id: "sl-10",
    variantId: "var-charger-20w",
    locationId: "loc-vi",
    onHand: 25,
    reserved: 0,
    reorderLevel: 5,
  },
  {
    id: "sl-11",
    variantId: "var-freepods4-blk",
    locationId: "loc-vi",
    onHand: 12,
    reserved: 0,
    reorderLevel: 4,
  },

  // Alaba Central Warehouse
  {
    id: "sl-12",
    variantId: "var-charger-20w",
    locationId: "loc-wh",
    onHand: 120,
    reserved: 0,
    reorderLevel: 25,
  },
  {
    id: "sl-13",
    variantId: "var-freepods4-blk",
    locationId: "loc-wh",
    onHand: 60,
    reserved: 0,
    reorderLevel: 15,
  },
  {
    id: "sl-14",
    variantId: "var-anker-20k",
    locationId: "loc-wh",
    onHand: 40,
    reserved: 0,
    reorderLevel: 10,
  },
  {
    id: "sl-15",
    variantId: "var-ip15pm-512-bt",
    locationId: "loc-wh",
    onHand: 1,
    reserved: 1,
    reorderLevel: 2,
  }, // 1 in transit
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: "cust-001",
    name: "Chief Adeleke Davies",
    phone: "08034567890",
    email: "adeleke.davies@lagosholding.com",
    address: "15 Alexander Road, Ikoyi, Lagos",
    ninOrBvn: "22194857102",
    balance: 0, // Paid in full
    creditLimit: 5000000,
    devicesOwned: [
      {
        id: "cd-1",
        stockUnitId: "unit-008",
        variantName: "iPhone 13 128GB - Midnight",
        imei: "359401103849102",
        serialNumber: "F2L8Z019KM",
        purchaseDate: "2026-09-02T16:00:00Z",
        saleId: "sale-001",
        receiptNumber: "HNR-2026-00812",
        warrantyExpiry: "2027-09-02T16:00:00Z",
      },
    ],
    notes: "VIP customer. Prefers brand-new Apple devices with invoice.",
    salesCount: 3,
    totalSpent: 3450000,
    createdAt: "2025-04-12T10:00:00Z",
  },
  {
    id: "cust-002",
    name: "Dr. Zainab Abubakar",
    phone: "08123456789",
    email: "zainab.abubakar@luth.edu.ng",
    address: "LUTH Staff Quarters, Idi-Araba, Lagos",
    ninOrBvn: "10293847561",
    balance: 150000, // ₦150k unpaid balance
    creditLimit: 1000000,
    devicesOwned: [],
    notes: "Bought accessories on credit. Salary payment arrives on the 25th.",
    salesCount: 2,
    totalSpent: 420000,
    createdAt: "2025-06-20T14:30:00Z",
  },
  {
    id: "cust-003",
    name: "Kenechukwu Obi",
    phone: "08098877665",
    email: "kobi.media@gmail.com",
    address: "8 Toyin Street, Ikeja, Lagos",
    balance: 0,
    creditLimit: 500000,
    devicesOwned: [],
    notes:
      "Videographer in Ikeja. Buys high-speed chargers and power banks regularly.",
    salesCount: 5,
    totalSpent: 280000,
    createdAt: "2025-07-05T09:15:00Z",
  },
];

export const INITIAL_SALES: Sale[] = [
  {
    id: "sale-001",
    receiptNumber: "HNR-2026-00812",
    timestamp: "2026-09-02T16:00:00Z",
    customerId: "cust-001",
    customerName: "Chief Adeleke Davies",
    customerPhone: "08034567890",
    locationId: "loc-ikeja",
    staffId: "staff-sales-1",
    staffName: "Babatunde Lawal",
    lines: [
      {
        id: "sline-1",
        variantId: "var-ip13-128-mdn",
        stockUnitId: "unit-008",
        imei: "359401103849102",
        productName: "Apple iPhone 13",
        variantName: "iPhone 13 128GB - Midnight",
        sku: "APL-13-128-MDN",
        quantity: 1,
        unitPrice: 820000,
        costPrice: 710000,
        discount: 0,
        total: 820000,
      },
      {
        id: "sline-2",
        variantId: "var-charger-20w",
        productName: "Apple 20W USB-C Power Adapter",
        variantName: "Apple 20W Power Adapter (UK 3-Pin)",
        sku: "ACC-APL-20W-UK",
        quantity: 1,
        unitPrice: 28000,
        costPrice: 19000,
        discount: 0,
        total: 28000,
      },
    ],
    subtotal: 848000,
    discountTotal: 0,
    vatAmount: 59163, // Derived 7.5% from 848,000 (848000 - 848000/1.075)
    grandTotal: 848000,
    paymentStatus: "PAID",
    payments: [
      {
        id: "spay-1",
        method: "TRANSFER",
        amount: 848000,
        reference: "TRF-GTB-90218491",
        timestamp: "2026-09-02T16:02:00Z",
      },
    ],
    amountPaid: 848000,
    balanceDue: 0,
    notes: "Delivery completed at Ikeja store counter.",
  },
];

export const INITIAL_TRANSFERS: Transfer[] = [
  {
    id: "trf-001",
    transferNumber: "TRF-2026-0012",
    fromLocationId: "loc-wh",
    toLocationId: "loc-vi",
    status: "DISPATCHED", // In-transit!
    dispatchDate: "2026-09-13T10:00:00Z",
    dispatchedByStaffId: "staff-inv-1",
    lines: [
      {
        id: "tline-1",
        variantId: "var-ip15pm-512-bt",
        variantName: "iPhone 15 Pro Max 512GB - Blue Titanium",
        sku: "APL-15PM-512-BT",
        stockUnitIds: ["unit-004"],
        imeis: ["358291104991023"],
        quantitySent: 1,
      },
      {
        id: "tline-2",
        variantId: "var-charger-20w",
        variantName: "Apple 20W Power Adapter (UK 3-Pin)",
        sku: "ACC-APL-20W-UK",
        quantitySent: 15,
      },
    ],
    notes: "Dispatched via GIG Logistics dispatch rider. Waybill #GIG-90412",
  },
];

export const INITIAL_PURCHASES: Purchase[] = [
  {
    id: "po-001",
    purchaseNumber: "PO-2026-0045",
    supplierId: "sup-redington",
    supplierName: "Redington Gulf Nigeria",
    locationId: "loc-ikeja",
    orderDate: "2026-08-14T09:00:00Z",
    status: "RECEIVED",
    lines: [
      {
        id: "pline-1",
        variantId: "var-ip15pm-256-nt",
        variantName: "iPhone 15 Pro Max 256GB - Natural Titanium",
        sku: "APL-15PM-256-NT",
        quantityOrdered: 3,
        quantityReceived: 3,
        unitCost: 1720000,
        totalCost: 5160000,
        imeisRecorded: [
          "358291104829104",
          "358291104829120",
          "358291104829146",
        ],
      },
    ],
    totalAmount: 5160000,
    paidAmount: 3710000,
    notes:
      "Delivery received in pristine condition with Apple warranty registration seal.",
  },
];

export const INITIAL_MOVEMENTS: StockMovement[] = [
  {
    id: "mov-1",
    referenceNumber: "PO-2026-0045",
    timestamp: "2026-08-15T10:30:00Z",
    movementType: "PURCHASE_RECEIPT",
    variantId: "var-ip15pm-256-nt",
    stockUnitId: "unit-001",
    toLocationId: "loc-ikeja",
    quantityChange: 1,
    costPrice: 1720000,
    staffId: "staff-inv-1",
    reason: "Purchase Receipt: Redington delivery (IMEI: 358291104829104)",
  },
  {
    id: "mov-2",
    referenceNumber: "PO-2026-0045",
    timestamp: "2026-08-15T10:30:00Z",
    movementType: "PURCHASE_RECEIPT",
    variantId: "var-ip15pm-256-nt",
    stockUnitId: "unit-002",
    toLocationId: "loc-ikeja",
    quantityChange: 1,
    costPrice: 1720000,
    staffId: "staff-inv-1",
    reason: "Purchase Receipt: Redington delivery (IMEI: 358291104829120)",
  },
  {
    id: "mov-3",
    referenceNumber: "HNR-2026-00812",
    timestamp: "2026-09-02T16:00:00Z",
    movementType: "SALE",
    variantId: "var-ip13-128-mdn",
    stockUnitId: "unit-008",
    fromLocationId: "loc-ikeja",
    quantityChange: -1,
    costPrice: 710000,
    staffId: "staff-sales-1",
    reason: "POS Sale to Chief Adeleke Davies (IMEI: 359401103849102)",
  },
  {
    id: "mov-4",
    referenceNumber: "HNR-2026-00812",
    timestamp: "2026-09-02T16:00:00Z",
    movementType: "SALE",
    variantId: "var-charger-20w",
    fromLocationId: "loc-ikeja",
    quantityChange: -1,
    costPrice: 19000,
    staffId: "staff-sales-1",
    reason: "POS Sale: Apple 20W Power Adapter",
  },
  {
    id: "mov-5",
    referenceNumber: "TRF-2026-0012",
    timestamp: "2026-09-13T10:00:00Z",
    movementType: "TRANSFER_DISPATCH",
    variantId: "var-ip15pm-512-bt",
    stockUnitId: "unit-004",
    fromLocationId: "loc-wh",
    toLocationId: "loc-vi",
    quantityChange: -1,
    costPrice: 1980000,
    staffId: "staff-inv-1",
    reason: "Transfer dispatch to Victoria Island branch",
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Low Stock Alert: iPhone 15 Pro Max",
    message: "Only 2 units remaining at Ikeja Branch. Reorder level reached.",
    type: "LOW_STOCK",
    timestamp: "2026-09-14T08:30:00Z",
    read: false,
    linkModule: "inventory",
  },
  {
    id: "notif-2",
    title: "Transfer Awaiting Receipt",
    message:
      "Transfer TRF-2026-0012 (Warehouse ➔ Victoria Island) was dispatched yesterday.",
    type: "TRANSFER_PENDING",
    timestamp: "2026-09-13T10:15:00Z",
    read: false,
    linkModule: "transfers",
  },
  {
    id: "notif-3",
    title: "Customer Payment Overdue",
    message:
      "Dr. Zainab Abubakar balance of ₦150,000 has been outstanding for 30 days.",
    type: "CUSTOMER_OVERDUE",
    timestamp: "2026-09-12T09:00:00Z",
    read: false,
    linkModule: "customers",
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "aud-1",
    timestamp: "2026-09-14T10:00:00Z",
    staffId: "staff-owner",
    staffName: "Onoja Michael",
    role: "OWNER",
    action: "PRICE_UPDATE",
    entityType: "Variant",
    entityId: "var-ip15pm-256-nt",
    details: "Adjusted selling price from ₦1,920,000 to ₦1,950,000 (VAT incl.)",
  },
  {
    id: "aud-2",
    timestamp: "2026-09-13T10:00:00Z",
    staffId: "staff-inv-1",
    staffName: "Emeka Nnamdi",
    role: "INVENTORY",
    action: "TRANSFER_DISPATCH",
    entityType: "Transfer",
    entityId: "trf-001",
    details:
      "Dispatched 1x iPhone 15PM 512GB & 15x 20W Chargers from WH-ALB to VI",
  },
  {
    id: "aud-3",
    timestamp: "2026-09-02T16:00:00Z",
    staffId: "staff-sales-1",
    staffName: "Babatunde Lawal",
    role: "SALES",
    action: "SALE_COMPLETED",
    entityType: "Sale",
    entityId: "sale-001",
    details:
      "Completed Sale HNR-2026-00812 for ₦848,000 (Customer: Chief Adeleke Davies)",
  },
];

// The preview contains examples only; never seed a live company with these records.
INITIAL_STAFF.forEach((s, i) => {
  s.name =
    [
      "Demo administrator",
      "Demo branch manager",
      "Demo salesperson",
      "Demo stock operator",
    ][i] || `Demo staff ${i + 1}`;
  s.email = `staff${i + 1}@example.test`;
  s.phone = "";
});
INITIAL_CUSTOMERS.forEach((c, i) => {
  c.name = `Demo customer ${i + 1}`;
  c.phone = `000000${i + 1}`;
  c.email = `customer${i + 1}@example.test`;
  c.address = "Example address";
  delete c.ninOrBvn;
});
INITIAL_SUPPLIERS.forEach((s, i) => {
  s.name = `Demo supplier ${i + 1}`;
  s.contactPerson = `Demo contact ${i + 1}`;
  s.phone = "";
  s.email = `supplier${i + 1}@example.test`;
  s.address = "Example supplier address";
  s.bankDetails = "Example settlement details";
});
INITIAL_SALES.forEach((s) => {
  s.customerName = INITIAL_CUSTOMERS.find((c) => c.id === s.customerId)?.name;
  s.customerPhone = INITIAL_CUSTOMERS.find((c) => c.id === s.customerId)?.phone;
  s.staffName =
    INITIAL_STAFF.find((p) => p.id === s.staffId)?.name || "Demo staff";
});
INITIAL_PURCHASES.forEach((p) => {
  p.supplierName =
    INITIAL_SUPPLIERS.find((s) => s.id === p.supplierId)?.name ||
    "Demo supplier";
});
INITIAL_LOCATIONS.forEach((l, i) => {
  l.address = `Example location ${i + 1}`;
  l.phone = "";
});
