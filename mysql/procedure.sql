DELIMITER $$
CREATE PROCEDURE `CollateData`()
BEGIN

REPLACE INTO tbl_hostmemdata
        (host_id, timestamp, memory)
    SELECT host_id,
           timestamp,
           SUM(memory) as memory
    FROM tbl_pgi2host
        JOIN tbl_pgidata USING (pgi_id)
        GROUP BY host_id, timestamp;

REPLACE INTO tbl_nsmemdata
        (namespaces, timestamp, memory)
    SELECT COALESCE (namespaces, 'none'),
           timestamp,
           SUM(memory) as memory
    FROM tbl_pgi2host
        JOIN tbl_pgidata USING (pgi_id)
        GROUP BY namespaces, timestamp;

DELETE FROM tbl_pgidata
    WHERE timestamp IN (
        SELECT timestamp FROM tbl_hostmemdata
          GROUP BY timestamp
    );
    
END$$
DELIMITER ;
