# gateway.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx, json, asyncio

app = FastAPI()

# Permitir conexiones CORS desde cualquier origen (esencial para desarrollo local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

clientes_navegador = []

# Diccionario de control de modelos para mapear eventos dinámicamente
estado_juego = {
    "Barcode_0": {"modelo": "#modelo-mago-glb", "tipoModelo": "glb", "activo": True},
    "Barcode_1": {"modelo": "modelos/mago.fbx", "tipoModelo": "fbx", "activo": True},
    "Barcode_2": {"modelo": "#modelo-model-glb", "tipoModelo": "glb", "activo": True},
    "Barcode_3": {"modelo": "modelos/mago.fbx", "tipoModelo": "fbx", "activo": True},
    "Hiro": {"modelo": "modelos/dragon.glb", "tipoModelo": "glb", "activo": True},
    "Kanji": {"modelo": "modelos/dragon.fbx", "tipoModelo": "fbx", "activo": True}
}

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    clientes_navegador.append(ws)
    print("Cliente web conectado al WebSocket.")
    try:
        while True:
            data = json.loads(await ws.receive_text())
            tipo_evento = data.get("tipo")
            marcador = data.get("marcador")
            
            config = estado_juego.get(marcador)
            if not config:
                continue
            
            if tipo_evento == "marcador_detectado" and config["activo"]:
                await ws.send_json({
                    "accion": "mostrar",
                    "marcador": marcador,
                    "modelo": config["modelo"],
                    "tipoModelo": config.get("tipoModelo", "glb")
                })
            elif tipo_evento == "marcador_perdido":
                await ws.send_json({
                    "accion": "ocultar",
                    "marcador": marcador
                })
    except WebSocketDisconnect:
        print("Cliente web desconectado.")
    finally:
        if ws in clientes_navegador:
            clientes_navegador.remove(ws)

@app.get("/historia")
async def historia():
    async def generador():
        async with httpx.AsyncClient() as client:
            # Asegúrate de usar un modelo descargado en tu Ollama local (ej. llama3.2 o qwen2.5)
            async with client.stream(
                "POST", 
                "http://localhost:11434/api/generate",
                json={"model": "llama3.2", "prompt": "Narrá como Dungeon Master la entrada del mago al calabozo."}
            ) as r:
                async for linea in r.aiter_text():
                    if linea:
                        data = json.loads(linea)
                        yield f"data: {data.get('response', '')}\n\n"
    return StreamingResponse(generador(), media_type="text/event-stream")