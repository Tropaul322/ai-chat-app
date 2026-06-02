-- Remove RAG: document storage, chunking, and vector search.

drop policy if exists "chat_documents_select_own" on public.chat_documents;
drop policy if exists "chat_documents_insert_own" on public.chat_documents;
drop policy if exists "chat_documents_delete_own" on public.chat_documents;

drop policy if exists "document_chunks_select_own" on public.document_chunks;

drop policy if exists "documents_select_own" on public.documents;
drop policy if exists "documents_insert_own" on public.documents;
drop policy if exists "documents_update_own" on public.documents;
drop policy if exists "documents_delete_own" on public.documents;

drop policy if exists "documents_storage_select_own" on storage.objects;
drop policy if exists "documents_storage_insert_own" on storage.objects;
drop policy if exists "documents_storage_update_own" on storage.objects;
drop policy if exists "documents_storage_delete_own" on storage.objects;

drop trigger if exists set_documents_updated_at on public.documents;

drop table if exists public.chat_documents;
drop table if exists public.document_chunks;
drop table if exists public.documents;

drop type if exists public.document_status;

drop extension if exists vector;
