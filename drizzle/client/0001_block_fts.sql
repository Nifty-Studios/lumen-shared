-- Full-text search over blocks. External-content FTS5 table backed by block.search_text,
-- kept in sync by triggers. Query: SELECT block.* FROM block_fts JOIN block ON block.rowid = block_fts.rowid
--   WHERE block_fts MATCH ? AND block.alive = 1 ORDER BY rank;
CREATE VIRTUAL TABLE `block_fts` USING fts5(search_text, content='block', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
--> statement-breakpoint
CREATE TRIGGER `block_fts_ai` AFTER INSERT ON `block` BEGIN
  INSERT INTO block_fts(rowid, search_text) VALUES (new.rowid, new.search_text);
END;
--> statement-breakpoint
CREATE TRIGGER `block_fts_ad` AFTER DELETE ON `block` BEGIN
  INSERT INTO block_fts(block_fts, rowid, search_text) VALUES ('delete', old.rowid, old.search_text);
END;
--> statement-breakpoint
CREATE TRIGGER `block_fts_au` AFTER UPDATE OF `search_text` ON `block` BEGIN
  INSERT INTO block_fts(block_fts, rowid, search_text) VALUES ('delete', old.rowid, old.search_text);
  INSERT INTO block_fts(rowid, search_text) VALUES (new.rowid, new.search_text);
END;
