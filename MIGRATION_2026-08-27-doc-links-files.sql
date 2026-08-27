-- Linked documents can be uploaded FILES (screenshots, PDFs) as well as Brain notes.
-- A link points at exactly one of: node_slug (Brain) or document_id (documents table).
alter table public.doc_links alter column node_slug drop not null;
alter table public.doc_links add column if not exists document_id uuid references public.documents(id) on delete cascade;
create unique index if not exists doc_links_document_unique
  on public.doc_links(user_id, entity_type, entity_id, document_id) where document_id is not null;
alter table public.doc_links drop constraint if exists doc_links_target_check;
alter table public.doc_links add constraint doc_links_target_check
  check ((node_slug is not null) <> (document_id is not null));
