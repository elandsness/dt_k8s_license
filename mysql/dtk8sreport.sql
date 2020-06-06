SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

CREATE TABLE `tbl_hostdata` (
  `host_id` varchar(22) COLLATE utf8mb4_unicode_ci NOT NULL,
  `displayName` varchar(16000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `consumedHostUnits` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tbl_hosthistory` (
  `id` int(11) NOT NULL,
  `entityId` varchar(22) COLLATE utf8mb4_unicode_ci NOT NULL,
  `month` int(2) NOT NULL,
  `year` int(4) NOT NULL,
  `consumedHostUnits` float NOT NULL,
  `memory` float NOT NULL,
  `adjustedHU` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tbl_pgi2host` (
  `pgi_id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `host_id` varchar(22) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `namespaces` varchar(16000) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tbl_pgidata` (
  `pgi_id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` bigint(15) NOT NULL,
  `memory` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


ALTER TABLE `tbl_hostdata`
  ADD PRIMARY KEY (`host_id`);

ALTER TABLE `tbl_hosthistory`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `tbl_pgi2host`
  ADD PRIMARY KEY (`pgi_id`);

ALTER TABLE `tbl_pgidata`
  ADD PRIMARY KEY (`pgi_id`,`timestamp`);


ALTER TABLE `tbl_hosthistory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;