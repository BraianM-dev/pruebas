from typing import Literal
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
app=FastAPI(title="Dungeon Master local")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["GET","POST"],allow_headers=["*"])
OLLAMA_URL="http://127.0.0.1:11434/api/generate";MODEL="llama3.2"
class Turno(BaseModel):
    accion:str=Field(min_length=1,max_length=240)
    progreso:int=Field(default=0,ge=0,le=3)
    tono:Literal["aventura","misterio"]="aventura"
@app.get("/salud")
async def salud():return {"ok":True,"modelo":MODEL}
@app.post("/narrar")
async def narrar(turno:Turno):
    prompt=f"""Eres Dungeon Master de un OA escolar llamado Calabozos & Código. Responde en español, en 70 palabras como máximo, sin violencia gráfica ni contenido adulto. Integra una pista breve sobre HTML, CSS o JavaScript. No resuelvas el reto directamente. Progreso: {turno.progreso}/3. Tono: {turno.tono}. Acción del grupo: {turno.accion}"""
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            r=await client.post(OLLAMA_URL,json={"model":MODEL,"prompt":prompt,"stream":False});r.raise_for_status();return {"relato":r.json().get("response","Las runas permanecen en silencio.").strip()}
    except Exception:return {"relato":"Una corriente azul recorre las paredes. El Guardián aconseja observar la estructura, el estilo y la interacción antes de avanzar.","modo":"respaldo"}
