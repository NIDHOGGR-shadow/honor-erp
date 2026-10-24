"""HTTP transport shared by native Python and the Workers JSPI runtime."""

import sys

import httpx


def request(method, url, **kwargs):
    if sys.platform != "emscripten":
        return httpx.request(method, url, **kwargs)
    from pyodide.ffi import run_sync

    async def send():
        async with httpx.AsyncClient() as client:
            return await client.request(method, url, **kwargs)

    return run_sync(send())
