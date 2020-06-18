ALTER TABLE `tbl_pgi2host` CHANGE `namespaces` `namespaces` VARCHAR(2500) NULL DEFAULT NULL;
ALTER TABLE `tbl_pgi2host` ADD `tenant` VARCHAR(2500) NULL AFTER `namespaces`;