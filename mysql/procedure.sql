DELIMITER $$
CREATE PROCEDURE `CollateData` ()  SQL SECURITY INVOKER
BEGIN
    DECLARE MaxTS BIGINT;
    
    SELECT MAX(timestamp)
      INTO MaxTS
      FROM tbl_pgidata;
    
    REPLACE INTO tbl_hostmemdata (host_id, timestamp, memory)
      SELECT host_id, timestamp, SUM(memory) as memory
      FROM tbl_pgi2host
      JOIN tbl_pgidata USING (pgi_id)
      WHERE host_id IS NOT NULL
      AND timestamp=MaxTS
      GROUP BY host_id, timestamp;

    REPLACE INTO tbl_nsmemdata (namespaces, timestamp, memory)
      SELECT COALESCE (namespaces, 'none'), timestamp, SUM(memory) as memory
      FROM tbl_pgi2host
      JOIN tbl_pgidata
      USING (pgi_id)
      WHERE namespaces IS NOT NULL
      AND timestamp=MaxTS
      GROUP BY namespaces, timestamp;

    DELETE FROM tbl_pgidata
      WHERE timestamp=MaxTS;
  END$$

CREATE PROCEDURE `CollateHistoric` ()  SQL SECURITY INVOKER
BEGIN
    DECLARE MaxTS BIGINT;
    
    SELECT MAX(timestamp)
      INTO MaxTS
      FROM tbl_pgidata;
    
    REPLACE INTO tbl_hostmemdata (host_id, timestamp, memory)
      SELECT host_id, timestamp, SUM(memory) as memory
      FROM tbl_pgi2host
      JOIN tbl_pgidata USING (pgi_id)
      WHERE host_id IS NOT NULL
      AND timestamp < MaxTS
      GROUP BY host_id, timestamp;

    REPLACE INTO tbl_nsmemdata (namespaces, timestamp, memory)
      SELECT COALESCE (namespaces, 'none'), timestamp, SUM(memory) as memory
      FROM tbl_pgi2host
      JOIN tbl_pgidata
      USING (pgi_id)
      WHERE namespaces IS NOT NULL
      AND timestamp < MaxTS
      GROUP BY namespaces, timestamp;

    DELETE FROM tbl_pgidata
      WHERE timestamp < MaxTS;
  END$$

DELIMITER ;
