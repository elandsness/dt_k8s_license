SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

CREATE TABLE `tbl_hostmemdata` (
  `host_id` varchar(22) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` bigint NOT NULL,
  `memory` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4_unicode_ci;

CREATE TABLE `tbl_nsmemdata` (
  `namespaces` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `timestamp` bigint NOT NULL,
  `memory` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4_unicode_ci;


ALTER TABLE `tbl_hostmemdata`
  ADD PRIMARY KEY (`host_id`,`timestamp`);

ALTER TABLE `tbl_nsmemdata`
  ADD PRIMARY KEY (`namespaces`,`timestamp`);
COMMIT;