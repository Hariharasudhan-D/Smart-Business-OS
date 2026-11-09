-- Product pictures can now be a small photo taken in the phone app (saved as a data:image/jpeg;base64 URL),
-- not only a web link, so the column needs more room than varchar(2048). Existing links are kept as they are.
alter table products alter column image set data type text;
