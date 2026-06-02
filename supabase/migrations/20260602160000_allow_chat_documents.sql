-- Allow message attachments to include lightweight documents as chat context.
-- The API still writes through the service role; direct client table/storage access stays revoked.

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'application/json',
    'application/pdf',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/csv',
    'text/markdown',
    'text/plain'
  ]
where id = 'chat-attachments';
