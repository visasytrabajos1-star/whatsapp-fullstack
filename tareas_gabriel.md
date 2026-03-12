# Tareas de Gabriel

Este archivo contiene los pasos necesarios para terminar de configurar el sistema de ALEX IO SaaS y solucionar los errores actuales.

## 1. Configuración de Almacenamiento (Storage)
Para que el nuevo botón "Examinar" en la sección de Campañas funcione correctamente:
- [ ] Entrar a [Supabase Dashboard](https://supabase.com).
- [ ] Ir a **Storage** y crear un bucket llamado `media`.
- [ ] **IMPORTANTE**: Marcar el bucket `media` como **PUBLIC**. De lo contrario, WhatsApp no podrá leer los archivos.
- [ ] Verificar que la política de "Read access to all users" esté activa en ese bucket.

## 2. Solución a "Error procesando el archivo para RAG"
Este error ocurre al subir documentos en la pestaña de Conocimiento. Para arreglarlo:
- [ ] Verificar que la variable `OPENAI_API_KEY` esté configurada en el archivo `.env` del servidor.
- [ ] Ejecutar el siguiente SQL en el **SQL Editor** de Supabase para crear la base de datos vectorial:

```sql
-- 1. Habilitar la extensión de vectores
create extension if not exists vector;

-- 2. Crear la tabla de fragmentos de documentos
create table if not exists document_chunks (
  id bigserial primary key,
  tenant_id uuid,
  instance_id text,
  document_name text,
  chunk_content text,
  embedding vector(1536) -- Tamaño para OpenAI text-embedding-ada-002
);

-- 3. Crear el índice para búsqueda rápida
create index on document_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- 4. Crear la función de búsqueda (RPC)
create or replace function match_document_chunks (
  query_embedding vector(1536),
  match_tenant_id uuid,
  match_instance_id text,
  match_count int
) returns table (
  id bigint,
  chunk_content text,
  document_name text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    document_chunks.id,
    document_chunks.chunk_content,
    document_chunks.document_name,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where document_chunks.tenant_id = match_tenant_id
    and document_chunks.instance_id = match_instance_id
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

## 3. Verificación de Versión
- [ ] El sistema está actualizado a la **v2.0.4.18 (Hardened | V8 Multi-Tenancy)**.
- [ ] Confirmar que el botón "Lanzar Campaña" funciona con el nuevo delay de 40s.
