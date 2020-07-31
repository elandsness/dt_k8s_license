SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

CREATE TABLE `tbl_hostdata` (
  `host_id` varchar(22) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `displayName` varchar(16000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `consumedHostUnits` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tbl_hosthistory` (
  `id` int NOT NULL,
  `entityId` varchar(22) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `month` int NOT NULL,
  `year` int NOT NULL,
  `consumedHostUnits` float NOT NULL,
  `memory` float NOT NULL,
  `adjustedHU` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tbl_hostmemdata` (
  `host_id` varchar(22) NOT NULL,
  `timestamp` bigint NOT NULL,
  `memory` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tbl_nsmemdata` (
  `namespaces` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` bigint NOT NULL,
  `memory` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tbl_pgi2host` (
  `pgi_id` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `host_id` varchar(22) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `namespaces` varchar(2500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tenant` varchar(2500) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tbl_pgidata` (
  `pgi_id` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` bigint NOT NULL,
  `memory` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `tbl_hostdata`
  ADD PRIMARY KEY (`host_id`);

ALTER TABLE `tbl_hosthistory`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `tbl_hostmemdata`
  ADD PRIMARY KEY (`host_id`,`timestamp`);

ALTER TABLE `tbl_nsmemdata`
  ADD PRIMARY KEY (`namespaces`,`timestamp`);

ALTER TABLE `tbl_pgi2host`
  ADD PRIMARY KEY (`pgi_id`);

ALTER TABLE `tbl_pgidata`
  ADD PRIMARY KEY (`pgi_id`,`timestamp`);

ALTER TABLE `tbl_hosthistory`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;
COMMIT;
