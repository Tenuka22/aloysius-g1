-- `account.issuer` is a custom column (not part of better-auth's own account
-- schema) with no default. better-auth's internal account-creation code
-- (sign-up, sign-in, OAuth callbacks) never sets it, so any account created
-- through better-auth itself crashed with a NOT NULL constraint violation
-- (surfaced as a 500 on the public sign-up form). Give it a default of
-- "credential", the only value this column has ever held in this app (no
-- OAuth providers are configured — emailAndPassword is the sole auth method).
DROP INDEX `account_issuer_accountId_uidx`;
ALTER TABLE `account` ADD COLUMN `issuer_with_default` TEXT NOT NULL DEFAULT 'credential';
UPDATE `account` SET `issuer_with_default` = `issuer`;
ALTER TABLE `account` DROP COLUMN `issuer`;
ALTER TABLE `account` RENAME COLUMN `issuer_with_default` TO `issuer`;
CREATE UNIQUE INDEX `account_issuer_accountId_uidx` ON `account` (`issuer`, `account_id`);
