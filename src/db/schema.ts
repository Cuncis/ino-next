import { pgTable, bigserial, uuid, varchar, bigint, serial, customType, text, smallint, timestamp, integer, date, jsonb, boolean, numeric, index, foreignKey, primaryKey, unique, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const attributes = pgTable("attributes", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	name: customType({ dataType: () => 'citext' })().notNull(),
	slug: customType({ dataType: () => 'citext' })().notNull(),
	type: varchar({ length: 255 }).default("pilihan").notNull(),
	values: jsonb(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	deletedAt: timestamp("deleted_at", { precision: 0 }),
}, (table) => [
	unique("attributes_name_unique").on(table.name),	unique("attributes_slug_unique").on(table.slug),check("attributes_type_check", sql`((type)::text = ANY (ARRAY[('pilihan'::character varying)::text, ('teks'::character varying)::text]))`),]);

export const auditLogs = pgTable("audit_logs", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	userId: bigint("user_id", { mode: 'number' }),
	branchId: bigint("branch_id", { mode: 'number' }),
	action: varchar({ length: 40 }).notNull(),
	auditableType: varchar("auditable_type", { length: 255 }).notNull(),
	auditableId: bigint("auditable_id", { mode: 'number' }).notNull(),
	oldValues: jsonb("old_values"),
	newValues: jsonb("new_values"),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: varchar("user_agent", { length: 255 }),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.branchId],
		foreignColumns: [branches.id],
		name: "audit_logs_branch_id_foreign"
	}).onDelete("set null"),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "audit_logs_user_id_foreign"
	}).onDelete("set null"),
	index("audit_logs_auditable_type_auditable_id_index").using("btree", table.auditableType.asc().nullsLast(), table.auditableId.asc().nullsLast()),
	index("audit_logs_created_at_index").using("btree", table.createdAt.asc().nullsLast()),
	index("audit_logs_user_id_created_at_index").using("btree", table.userId.asc().nullsLast(), table.createdAt.asc().nullsLast()),
]);

export const branchStocks = pgTable("branch_stocks", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	branchId: bigint("branch_id", { mode: 'number' }).notNull(),
	productId: bigint("product_id", { mode: 'number' }).notNull(),
	quantity: integer().default(0).notNull(),
	reservedQuantity: integer("reserved_quantity").default(0).notNull(),
	reorderPoint: integer("reorder_point").default(0).notNull(),
	priceOverride: bigint("price_override", { mode: 'number' }),
	isListed: boolean("is_listed").default(true).notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.branchId],
		foreignColumns: [branches.id],
		name: "branch_stocks_branch_id_foreign"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.productId],
		foreignColumns: [products.id],
		name: "branch_stocks_product_id_foreign"
	}).onDelete("cascade"),
	index("branch_stocks_product_id_is_listed_quantity_index").using("btree", table.productId.asc().nullsLast(), table.isListed.asc().nullsLast(), table.quantity.asc().nullsLast()),
	unique("branch_stocks_branch_id_product_id_unique").on(table.branchId, table.productId),]);

export const branches = pgTable("branches", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	code: customType({ dataType: () => 'citext' })().notNull(),
	name: customType({ dataType: () => 'citext' })().notNull(),
	slug: customType({ dataType: () => 'citext' })().notNull(),
	addressLine: varchar("address_line", { length: 255 }).notNull(),
	kelurahan: varchar({ length: 80 }),
	kecamatan: varchar({ length: 80 }),
	kota: varchar({ length: 80 }).notNull(),
	provinsi: varchar({ length: 80 }).notNull(),
	postalCode: varchar("postal_code", { length: 10 }),
	latitude: numeric({ precision: 10, scale: 7 }),
	longitude: numeric({ precision: 10, scale: 7 }),
	mapsUrl: varchar("maps_url", { length: 255 }),
	phone: varchar({ length: 30 }),
	whatsapp: varchar({ length: 30 }),
	siaNumber: varchar("sia_number", { length: 60 }),
	apjName: varchar("apj_name", { length: 255 }),
	apjSipaNumber: varchar("apj_sipa_number", { length: 60 }),
	operatingHours: jsonb("operating_hours"),
	supportsDelivery: boolean("supports_delivery").default(true).notNull(),
	supportsPickup: boolean("supports_pickup").default(true).notNull(),
	deliveryRadiusKm: smallint("delivery_radius_km").default(10).notNull(),
	status: varchar({ length: 255 }).default("aktif").notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	deletedAt: timestamp("deleted_at", { precision: 0 }),
	photoPath: varchar("photo_path", { length: 255 }),
	practiceSchedule: varchar("practice_schedule", { length: 120 }),
	storeSchedule: varchar("store_schedule", { length: 120 }),
}, (table) => [
	index("branches_provinsi_kota_index").using("btree", table.provinsi.asc().nullsLast(), table.kota.asc().nullsLast()),
	index("branches_status_latitude_longitude_index").using("btree", table.status.asc().nullsLast(), table.latitude.asc().nullsLast(), table.longitude.asc().nullsLast()),
	unique("branches_code_unique").on(table.code),	unique("branches_slug_unique").on(table.slug),check("branches_status_check", sql`((status)::text = ANY (ARRAY[('aktif'::character varying)::text, ('tutup sementara'::character varying)::text, ('tutup permanen'::character varying)::text]))`),]);

export const cache = pgTable("cache", {
	key: varchar({ length: 255 }).primaryKey(),
	value: text().notNull(),
	expiration: bigint({ mode: 'number' }).notNull(),
}, (table) => [
	index("cache_expiration_index").using("btree", table.expiration.asc().nullsLast()),
]);

export const cacheLocks = pgTable("cache_locks", {
	key: varchar({ length: 255 }).primaryKey(),
	owner: varchar({ length: 255 }).notNull(),
	expiration: bigint({ mode: 'number' }).notNull(),
}, (table) => [
	index("cache_locks_expiration_index").using("btree", table.expiration.asc().nullsLast()),
]);

export const cartItems = pgTable("cart_items", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	cartId: bigint("cart_id", { mode: 'number' }).notNull(),
	productId: bigint("product_id", { mode: 'number' }).notNull(),
	quantity: integer().notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.cartId],
		foreignColumns: [carts.id],
		name: "cart_items_cart_id_foreign"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.productId],
		foreignColumns: [products.id],
		name: "cart_items_product_id_foreign"
	}).onDelete("cascade"),
	unique("cart_items_cart_id_product_id_unique").on(table.cartId, table.productId),]);

export const carts = pgTable("carts", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	customerId: bigint("customer_id", { mode: 'number' }).notNull(),
	branchId: bigint("branch_id", { mode: 'number' }),
	customerAddressId: bigint("customer_address_id", { mode: 'number' }),
	couponId: bigint("coupon_id", { mode: 'number' }),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.branchId],
		foreignColumns: [branches.id],
		name: "carts_branch_id_foreign"
	}).onDelete("set null"),
	foreignKey({
		columns: [table.couponId],
		foreignColumns: [coupons.id],
		name: "carts_coupon_id_foreign"
	}).onDelete("set null"),
	foreignKey({
		columns: [table.customerAddressId],
		foreignColumns: [customerAddresses.id],
		name: "carts_customer_address_id_foreign"
	}).onDelete("set null"),
	foreignKey({
		columns: [table.customerId],
		foreignColumns: [customers.id],
		name: "carts_customer_id_foreign"
	}).onDelete("cascade"),
	unique("carts_customer_id_unique").on(table.customerId),]);

export const categories = pgTable("categories", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	name: customType({ dataType: () => 'citext' })().notNull(),
	slug: customType({ dataType: () => 'citext' })().notNull(),
	description: text(),
	imagePath: varchar("image_path", { length: 255 }),
	parentId: bigint("parent_id", { mode: 'number' }),
	position: smallint().default(0).notNull(),
	status: varchar({ length: 255 }).default("aktif").notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	deletedAt: timestamp("deleted_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.parentId],
		foreignColumns: [table.id],
		name: "categories_parent_id_foreign"
	}).onDelete("set null"),
	index("categories_status_position_index").using("btree", table.status.asc().nullsLast(), table.position.asc().nullsLast()),
	unique("categories_name_unique").on(table.name),	unique("categories_slug_unique").on(table.slug),check("categories_status_check", sql`((status)::text = ANY (ARRAY[('aktif'::character varying)::text, ('nonaktif'::character varying)::text]))`),]);

export const chatConversations = pgTable("chat_conversations", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	token: varchar({ length: 40 }).notNull(),
	name: varchar({ length: 120 }).notNull(),
	email: varchar({ length: 190 }).notNull(),
	status: varchar({ length: 255 }).default("terbuka").notNull(),
	adminUnreadCount: smallint("admin_unread_count").default(0).notNull(),
	lastMessageAt: timestamp("last_message_at", { precision: 0 }),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	index("chat_conversations_email_index").using("btree", table.email.asc().nullsLast()),
	index("chat_conversations_last_message_at_index").using("btree", table.lastMessageAt.asc().nullsLast()),
	index("chat_conversations_status_last_message_at_index").using("btree", table.status.asc().nullsLast(), table.lastMessageAt.asc().nullsLast()),
	unique("chat_conversations_token_unique").on(table.token),check("chat_conversations_status_check", sql`((status)::text = ANY (ARRAY[('terbuka'::character varying)::text, ('ditutup'::character varying)::text]))`),]);

export const chatMessages = pgTable("chat_messages", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	chatConversationId: bigint("chat_conversation_id", { mode: 'number' }).notNull(),
	sender: varchar({ length: 255 }).notNull(),
	userId: bigint("user_id", { mode: 'number' }),
	body: text().notNull(),
	visitorSeenAt: timestamp("visitor_seen_at", { precision: 0 }),
	emailedAt: timestamp("emailed_at", { precision: 0 }),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.chatConversationId],
		foreignColumns: [chatConversations.id],
		name: "chat_messages_chat_conversation_id_foreign"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "chat_messages_user_id_foreign"
	}).onDelete("set null"),
	index("chat_messages_chat_conversation_id_id_index").using("btree", table.chatConversationId.asc().nullsLast(), table.id.asc().nullsLast()),
check("chat_messages_sender_check", sql`((sender)::text = ANY (ARRAY[('pengunjung'::character varying)::text, ('admin'::character varying)::text]))`),]);

export const couponBranch = pgTable("coupon_branch", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	couponId: bigint("coupon_id", { mode: 'number' }).notNull(),
	branchId: bigint("branch_id", { mode: 'number' }).notNull(),
}, (table) => [
	foreignKey({
		columns: [table.branchId],
		foreignColumns: [branches.id],
		name: "coupon_branch_branch_id_foreign"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.couponId],
		foreignColumns: [coupons.id],
		name: "coupon_branch_coupon_id_foreign"
	}).onDelete("cascade"),
	unique("coupon_branch_coupon_id_branch_id_unique").on(table.couponId, table.branchId),]);

export const coupons = pgTable("coupons", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	code: customType({ dataType: () => 'citext' })().notNull(),
	type: varchar({ length: 255 }).notNull(),
	value: integer().default(0).notNull(),
	minimumPurchase: bigint("minimum_purchase", { mode: 'number' }),
	quota: integer(),
	usedCount: integer("used_count").default(0).notNull(),
	startsAt: timestamp("starts_at", { precision: 0 }),
	expiresAt: timestamp("expires_at", { precision: 0 }),
	status: varchar({ length: 255 }).default("aktif").notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	deletedAt: timestamp("deleted_at", { precision: 0 }),
}, (table) => [
	index("coupons_status_expires_at_index").using("btree", table.status.asc().nullsLast(), table.expiresAt.asc().nullsLast()),
	unique("coupons_code_unique").on(table.code),check("coupons_status_check", sql`((status)::text = ANY (ARRAY[('aktif'::character varying)::text, ('nonaktif'::character varying)::text]))`),check("coupons_type_check", sql`((type)::text = ANY (ARRAY[('persentase'::character varying)::text, ('nominal'::character varying)::text, ('ongkir gratis'::character varying)::text]))`),]);

export const customerAddresses = pgTable("customer_addresses", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	customerId: bigint("customer_id", { mode: 'number' }).notNull(),
	label: varchar({ length: 40 }).default("Rumah").notNull(),
	recipientName: varchar("recipient_name", { length: 255 }).notNull(),
	phone: varchar({ length: 30 }).notNull(),
	addressLine: varchar("address_line", { length: 255 }).notNull(),
	kelurahan: varchar({ length: 80 }),
	kecamatan: varchar({ length: 80 }),
	kota: varchar({ length: 80 }).notNull(),
	provinsi: varchar({ length: 80 }).notNull(),
	postalCode: varchar("postal_code", { length: 10 }),
	note: varchar({ length: 255 }),
	latitude: numeric({ precision: 10, scale: 7 }),
	longitude: numeric({ precision: 10, scale: 7 }),
	isDefault: boolean("is_default").default(false).notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.customerId],
		foreignColumns: [customers.id],
		name: "customer_addresses_customer_id_foreign"
	}).onDelete("cascade"),
	index("customer_addresses_customer_id_is_default_index").using("btree", table.customerId.asc().nullsLast(), table.isDefault.asc().nullsLast()),
]);

export const customerPasswordResetTokens = pgTable("customer_password_reset_tokens", {
	email: varchar({ length: 255 }).primaryKey(),
	token: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
});

export const customers = pgTable("customers", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	code: customType({ dataType: () => 'citext' })().notNull(),
	name: varchar({ length: 255 }).notNull(),
	email: customType({ dataType: () => 'citext' })().notNull(),
	emailVerifiedAt: timestamp("email_verified_at", { precision: 0 }),
	phone: varchar({ length: 30 }),
	phoneVerifiedAt: timestamp("phone_verified_at", { precision: 0 }),
	password: varchar({ length: 255 }).notNull(),
	avatarPath: varchar("avatar_path", { length: 255 }),
	preferredBranchId: bigint("preferred_branch_id", { mode: 'number' }),
	status: varchar({ length: 255 }).default("aktif").notNull(),
	consentAt: timestamp("consent_at", { precision: 0 }),
	consentVersion: varchar("consent_version", { length: 20 }),
	allowsLocation: boolean("allows_location").default(false).notNull(),
	rememberToken: varchar("remember_token", { length: 100 }),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	deletedAt: timestamp("deleted_at", { precision: 0 }),
	phoneOtpCode: varchar("phone_otp_code", { length: 255 }),
	phoneOtpExpiresAt: timestamp("phone_otp_expires_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.preferredBranchId],
		foreignColumns: [branches.id],
		name: "customers_preferred_branch_id_foreign"
	}).onDelete("set null"),
	index("customers_status_index").using("btree", table.status.asc().nullsLast()),
	unique("customers_code_unique").on(table.code),	unique("customers_email_unique").on(table.email),check("customers_status_check", sql`((status)::text = ANY (ARRAY[('aktif'::character varying)::text, ('nonaktif'::character varying)::text, ('diblokir'::character varying)::text]))`),]);

export const failedJobs = pgTable("failed_jobs", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	uuid: varchar({ length: 255 }).notNull(),
	connection: varchar({ length: 255 }).notNull(),
	queue: varchar({ length: 255 }).notNull(),
	payload: text().notNull(),
	exception: text().notNull(),
	failedAt: timestamp("failed_at", { precision: 0 }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("failed_jobs_connection_queue_failed_at_index").using("btree", table.connection.asc().nullsLast(), table.queue.asc().nullsLast(), table.failedAt.asc().nullsLast()),
	unique("failed_jobs_uuid_unique").on(table.uuid),]);

export const inventoryBatches = pgTable("inventory_batches", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	branchId: bigint("branch_id", { mode: 'number' }).notNull(),
	productId: bigint("product_id", { mode: 'number' }).notNull(),
	batchNumber: customType({ dataType: () => 'citext' })("batch_number").notNull(),
	expiresAt: date("expires_at").notNull(),
	quantity: integer().default(0).notNull(),
	costPrice: bigint("cost_price", { mode: 'number' }),
	receivedAt: date("received_at"),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	expiryReminderSentAt: timestamp("expiry_reminder_sent_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.branchId],
		foreignColumns: [branches.id],
		name: "inventory_batches_branch_id_foreign"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.productId],
		foreignColumns: [products.id],
		name: "inventory_batches_product_id_foreign"
	}).onDelete("cascade"),
	index("inventory_batches_branch_id_product_id_expires_at_index").using("btree", table.branchId.asc().nullsLast(), table.productId.asc().nullsLast(), table.expiresAt.asc().nullsLast()),
	index("inventory_batches_expires_at_index").using("btree", table.expiresAt.asc().nullsLast()),
	unique("inventory_batches_branch_id_product_id_batch_number_unique").on(table.branchId, table.productId, table.batchNumber),]);

export const inventoryMovements = pgTable("inventory_movements", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	branchId: bigint("branch_id", { mode: 'number' }).notNull(),
	productId: bigint("product_id", { mode: 'number' }).notNull(),
	inventoryBatchId: bigint("inventory_batch_id", { mode: 'number' }),
	type: varchar({ length: 255 }).notNull(),
	quantity: integer().notNull(),
	balanceAfter: integer("balance_after"),
	referenceType: varchar("reference_type", { length: 255 }),
	referenceId: bigint("reference_id", { mode: 'number' }),
	note: varchar({ length: 255 }),
	userId: bigint("user_id", { mode: 'number' }),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.branchId],
		foreignColumns: [branches.id],
		name: "inventory_movements_branch_id_foreign"
	}).onDelete("restrict"),
	foreignKey({
		columns: [table.inventoryBatchId],
		foreignColumns: [inventoryBatches.id],
		name: "inventory_movements_inventory_batch_id_foreign"
	}).onDelete("set null"),
	foreignKey({
		columns: [table.productId],
		foreignColumns: [products.id],
		name: "inventory_movements_product_id_foreign"
	}).onDelete("restrict"),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "inventory_movements_user_id_foreign"
	}).onDelete("set null"),
	index("inventory_movements_branch_id_product_id_created_at_index").using("btree", table.branchId.asc().nullsLast(), table.productId.asc().nullsLast(), table.createdAt.asc().nullsLast()),
	index("inventory_movements_reference_type_reference_id_index").using("btree", table.referenceType.asc().nullsLast(), table.referenceId.asc().nullsLast()),
	index("inventory_movements_type_index").using("btree", table.type.asc().nullsLast()),
check("inventory_movements_type_check", sql`((type)::text = ANY (ARRAY[('pembelian'::character varying)::text, ('penjualan'::character varying)::text, ('retur masuk'::character varying)::text, ('retur keluar'::character varying)::text, ('transfer masuk'::character varying)::text, ('transfer keluar'::character varying)::text, ('penyesuaian'::character varying)::text, ('kedaluwarsa'::character varying)::text, ('rusak'::character varying)::text]))`),]);

export const jobBatches = pgTable("job_batches", {
	id: varchar({ length: 255 }).primaryKey(),
	name: varchar({ length: 255 }).notNull(),
	totalJobs: integer("total_jobs").notNull(),
	pendingJobs: integer("pending_jobs").notNull(),
	failedJobs: integer("failed_jobs").notNull(),
	failedJobIds: text("failed_job_ids").notNull(),
	options: text(),
	cancelledAt: integer("cancelled_at"),
	createdAt: integer("created_at").notNull(),
	finishedAt: integer("finished_at"),
});

export const jobs = pgTable("jobs", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	queue: varchar({ length: 255 }).notNull(),
	payload: text().notNull(),
	attempts: smallint().notNull(),
	reservedAt: integer("reserved_at"),
	availableAt: integer("available_at").notNull(),
	createdAt: integer("created_at").notNull(),
}, (table) => [
	index("jobs_queue_index").using("btree", table.queue.asc().nullsLast()),
]);

export const migrations = pgTable("migrations", {
	id: serial().primaryKey(),
	migration: varchar({ length: 255 }).notNull(),
	batch: integer().notNull(),
});

export const modelHasPermissions = pgTable("model_has_permissions", {
	permissionId: bigint("permission_id", { mode: 'number' }).notNull(),
	modelType: varchar("model_type", { length: 255 }).notNull(),
	modelId: bigint("model_id", { mode: 'number' }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.permissionId, table.modelId, table.modelType], name: "model_has_permissions_pkey"}),
	foreignKey({
		columns: [table.permissionId],
		foreignColumns: [permissions.id],
		name: "model_has_permissions_permission_id_foreign"
	}).onDelete("cascade"),
	index("model_has_permissions_model_id_model_type_index").using("btree", table.modelId.asc().nullsLast(), table.modelType.asc().nullsLast()),
]);

export const modelHasRoles = pgTable("model_has_roles", {
	roleId: bigint("role_id", { mode: 'number' }).notNull(),
	modelType: varchar("model_type", { length: 255 }).notNull(),
	modelId: bigint("model_id", { mode: 'number' }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.roleId, table.modelId, table.modelType], name: "model_has_roles_pkey"}),
	foreignKey({
		columns: [table.roleId],
		foreignColumns: [roles.id],
		name: "model_has_roles_role_id_foreign"
	}).onDelete("cascade"),
	index("model_has_roles_model_id_model_type_index").using("btree", table.modelId.asc().nullsLast(), table.modelType.asc().nullsLast()),
]);

export const newsletterDeliveries = pgTable("newsletter_deliveries", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	newsletterId: bigint("newsletter_id", { mode: 'number' }).notNull(),
	subscriberId: bigint("subscriber_id", { mode: 'number' }).notNull(),
	status: varchar({ length: 20 }).notNull(),
	error: text(),
	sentAt: timestamp("sent_at", { precision: 0 }),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.newsletterId],
		foreignColumns: [newsletters.id],
		name: "newsletter_deliveries_newsletter_id_foreign"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.subscriberId],
		foreignColumns: [subscribers.id],
		name: "newsletter_deliveries_subscriber_id_foreign"
	}).onDelete("cascade"),
	unique("newsletter_deliveries_newsletter_id_subscriber_id_unique").on(table.newsletterId, table.subscriberId),]);

export const newsletters = pgTable("newsletters", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	name: varchar({ length: 255 }).notNull(),
	subject: varchar({ length: 255 }).notNull(),
	previewText: varchar("preview_text", { length: 255 }),
	content: text(),
	status: varchar({ length: 20 }).default("draf").notNull(),
	sentAt: timestamp("sent_at", { precision: 0 }),
	recipientCount: integer("recipient_count").default(0).notNull(),
	successCount: integer("success_count").default(0).notNull(),
	failedCount: integer("failed_count").default(0).notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	customHtml: text("custom_html"),
}, (table) => [
	index("newsletters_status_index").using("btree", table.status.asc().nullsLast()),
]);

export const notifications = pgTable("notifications", {
	id: uuid().primaryKey(),
	type: varchar({ length: 255 }).notNull(),
	notifiableType: varchar("notifiable_type", { length: 255 }).notNull(),
	notifiableId: bigint("notifiable_id", { mode: 'number' }).notNull(),
	data: jsonb().notNull(),
	readAt: timestamp("read_at", { precision: 0 }),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	index("notifications_notifiable_type_notifiable_id_index").using("btree", table.notifiableType.asc().nullsLast(), table.notifiableId.asc().nullsLast()),
]);

export const orderItems = pgTable("order_items", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	orderId: bigint("order_id", { mode: 'number' }).notNull(),
	productId: bigint("product_id", { mode: 'number' }),
	productName: varchar("product_name", { length: 255 }).notNull(),
	sku: varchar({ length: 40 }),
	unitPrice: bigint("unit_price", { mode: 'number' }).notNull(),
	quantity: integer().notNull(),
	lineTotal: bigint("line_total", { mode: 'number' }).notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	batchesConsumed: jsonb("batches_consumed"),
}, (table) => [
	foreignKey({
		columns: [table.orderId],
		foreignColumns: [orders.id],
		name: "order_items_order_id_foreign"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.productId],
		foreignColumns: [products.id],
		name: "order_items_product_id_foreign"
	}).onDelete("set null"),
	index("order_items_order_id_index").using("btree", table.orderId.asc().nullsLast()),
]);

export const orders = pgTable("orders", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	number: customType({ dataType: () => 'citext' })().notNull(),
	branchId: bigint("branch_id", { mode: 'number' }).notNull(),
	customerId: bigint("customer_id", { mode: 'number' }).notNull(),
	fulfilment: varchar({ length: 255 }).notNull(),
	status: varchar({ length: 255 }).default("menunggu pembayaran").notNull(),
	paymentMethod: varchar("payment_method", { length: 40 }),
	paymentStatus: varchar("payment_status", { length: 255 }).default("belum bayar").notNull(),
	subtotal: bigint({ mode: 'number' }).default(0).notNull(),
	discountTotal: bigint("discount_total", { mode: 'number' }).default(0).notNull(),
	shippingTotal: bigint("shipping_total", { mode: 'number' }).default(0).notNull(),
	taxTotal: bigint("tax_total", { mode: 'number' }).default(0).notNull(),
	grandTotal: bigint("grand_total", { mode: 'number' }).default(0).notNull(),
	recipientName: varchar("recipient_name", { length: 255 }),
	recipientPhone: varchar("recipient_phone", { length: 30 }),
	shippingAddress: text("shipping_address"),
	shippingLatitude: numeric("shipping_latitude", { precision: 10, scale: 7 }),
	shippingLongitude: numeric("shipping_longitude", { precision: 10, scale: 7 }),
	note: text(),
	paidAt: timestamp("paid_at", { precision: 0 }),
	readyAt: timestamp("ready_at", { precision: 0 }),
	completedAt: timestamp("completed_at", { precision: 0 }),
	cancelledAt: timestamp("cancelled_at", { precision: 0 }),
	expiresAt: timestamp("expires_at", { precision: 0 }),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	deletedAt: timestamp("deleted_at", { precision: 0 }),
	couponId: bigint("coupon_id", { mode: 'number' }),
	pickupCode: varchar("pickup_code", { length: 10 }),
	pickupCodeExpiresAt: timestamp("pickup_code_expires_at", { precision: 0 }),
	pickedUpAt: timestamp("picked_up_at", { precision: 0 }),
	handedOverBy: bigint("handed_over_by", { mode: 'number' }),
	pickupReminderSentAt: timestamp("pickup_reminder_sent_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.branchId],
		foreignColumns: [branches.id],
		name: "orders_branch_id_foreign"
	}).onDelete("restrict"),
	foreignKey({
		columns: [table.couponId],
		foreignColumns: [coupons.id],
		name: "orders_coupon_id_foreign"
	}).onDelete("set null"),
	foreignKey({
		columns: [table.customerId],
		foreignColumns: [customers.id],
		name: "orders_customer_id_foreign"
	}).onDelete("restrict"),
	foreignKey({
		columns: [table.handedOverBy],
		foreignColumns: [users.id],
		name: "orders_handed_over_by_foreign"
	}).onDelete("set null"),
	index("orders_branch_id_status_index").using("btree", table.branchId.asc().nullsLast(), table.status.asc().nullsLast()),
	index("orders_customer_id_created_at_index").using("btree", table.customerId.asc().nullsLast(), table.createdAt.asc().nullsLast()),
	index("orders_payment_status_index").using("btree", table.paymentStatus.asc().nullsLast()),
	index("orders_status_expires_at_index").using("btree", table.status.asc().nullsLast(), table.expiresAt.asc().nullsLast()),
	index("orders_status_pickup_code_expires_at_index").using("btree", table.status.asc().nullsLast(), table.pickupCodeExpiresAt.asc().nullsLast()),
	unique("orders_number_unique").on(table.number),check("orders_fulfilment_check", sql`((fulfilment)::text = ANY (ARRAY[('antar'::character varying)::text, ('ambil'::character varying)::text]))`),check("orders_payment_status_check", sql`((payment_status)::text = ANY (ARRAY[('belum bayar'::character varying)::text, ('lunas'::character varying)::text, ('gagal'::character varying)::text, ('refund'::character varying)::text]))`),check("orders_status_check", sql`((status)::text = ANY (ARRAY[('menunggu pembayaran'::character varying)::text, ('pembayaran diterima'::character varying)::text, ('siap dikirim'::character varying)::text, ('siap diambil'::character varying)::text, ('dikirim'::character varying)::text, ('selesai'::character varying)::text, ('dibatalkan'::character varying)::text, ('kedaluwarsa'::character varying)::text]))`),]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	email: varchar({ length: 255 }).primaryKey(),
	token: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
});

export const payments = pgTable("payments", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	orderId: bigint("order_id", { mode: 'number' }).notNull(),
	gateway: varchar({ length: 20 }).default("doku").notNull(),
	invoiceNumber: varchar("invoice_number", { length: 80 }).notNull(),
	status: varchar({ length: 255 }).default("pending").notNull(),
	amount: bigint({ mode: 'number' }).notNull(),
	requestId: varchar("request_id", { length: 128 }),
	tokenId: varchar("token_id", { length: 255 }),
	channel: varchar({ length: 60 }),
	checkoutUrl: text("checkout_url"),
	expiresAt: timestamp("expires_at", { precision: 0 }),
	paidAt: timestamp("paid_at", { precision: 0 }),
	refundedAt: timestamp("refunded_at", { precision: 0 }),
	refundNote: text("refund_note"),
	rawResponse: jsonb("raw_response"),
	rawNotification: jsonb("raw_notification"),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.orderId],
		foreignColumns: [orders.id],
		name: "payments_order_id_foreign"
	}).onDelete("restrict"),
	index("payments_order_id_status_index").using("btree", table.orderId.asc().nullsLast(), table.status.asc().nullsLast()),
	index("payments_status_index").using("btree", table.status.asc().nullsLast()),
	unique("payments_invoice_number_unique").on(table.invoiceNumber),check("payments_status_check", sql`((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('success'::character varying)::text, ('failed'::character varying)::text, ('expired'::character varying)::text, ('refunded'::character varying)::text]))`),]);

export const permissions = pgTable("permissions", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	name: varchar({ length: 255 }).notNull(),
	guardName: varchar("guard_name", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	unique("permissions_name_guard_name_unique").on(table.name, table.guardName),]);

export const productImages = pgTable("product_images", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	productId: bigint("product_id", { mode: 'number' }).notNull(),
	path: varchar({ length: 255 }).notNull(),
	alt: varchar({ length: 255 }),
	position: smallint().default(0).notNull(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.productId],
		foreignColumns: [products.id],
		name: "product_images_product_id_foreign"
	}).onDelete("cascade"),
	index("product_images_product_id_position_index").using("btree", table.productId.asc().nullsLast(), table.position.asc().nullsLast()),
]);

export const products = pgTable("products", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	sku: customType({ dataType: () => 'citext' })().notNull(),
	name: varchar({ length: 255 }).notNull(),
	slug: customType({ dataType: () => 'citext' })().notNull(),
	categoryId: bigint("category_id", { mode: 'number' }).notNull(),
	supplierId: bigint("supplier_id", { mode: 'number' }),
	price: bigint({ mode: 'number' }).notNull(),
	oldPrice: bigint("old_price", { mode: 'number' }),
	costPrice: bigint("cost_price", { mode: 'number' }),
	unit: varchar({ length: 30 }).default("Pcs").notNull(),
	blurb: text(),
	description: text(),
	drugClass: varchar("drug_class", { length: 255 }).default("non-obat").notNull(),
	nieBpom: varchar("nie_bpom", { length: 40 }),
	composition: varchar({ length: 255 }),
	indication: text(),
	dosage: text(),
	sideEffects: text("side_effects"),
	warning: text(),
	manufacturer: varchar({ length: 255 }),
	requiresPrescription: boolean("requires_prescription").default(false).notNull(),
	maxQtyPerOrder: smallint("max_qty_per_order"),
	storage: varchar({ length: 255 }).default("suhu ruang").notNull(),
	weightGrams: integer("weight_grams").default(0).notNull(),
	soldCount: bigint("sold_count", { mode: 'number' }).default(0).notNull(),
	rating: numeric({ mode: 'number', precision: 3, scale: 2 }).default(0).notNull(),
	status: varchar({ length: 255 }).default("aktif").notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	deletedAt: timestamp("deleted_at", { precision: 0 }),
	lengthCm: smallint("length_cm").default(0).notNull(),
	widthCm: smallint("width_cm").default(0).notNull(),
	heightCm: smallint("height_cm").default(0).notNull(),
}, (table) => [
	foreignKey({
		columns: [table.categoryId],
		foreignColumns: [categories.id],
		name: "products_category_id_foreign"
	}).onDelete("restrict"),
	foreignKey({
		columns: [table.supplierId],
		foreignColumns: [suppliers.id],
		name: "products_supplier_id_foreign"
	}).onDelete("restrict"),
	index("products_drug_class_index").using("btree", table.drugClass.asc().nullsLast()),
	index("products_status_category_id_index").using("btree", table.status.asc().nullsLast(), table.categoryId.asc().nullsLast()),
	unique("products_sku_unique").on(table.sku),	unique("products_slug_unique").on(table.slug),check("products_drug_class_check", sql`((drug_class)::text = ANY (ARRAY[('bebas'::character varying)::text, ('bebas terbatas'::character varying)::text, ('keras'::character varying)::text, ('non-obat'::character varying)::text]))`),check("products_status_check", sql`((status)::text = ANY (ARRAY[('aktif'::character varying)::text, ('nonaktif'::character varying)::text, ('arsip'::character varying)::text]))`),check("products_storage_check", sql`((storage)::text = ANY (ARRAY[('suhu ruang'::character varying)::text, ('sejuk'::character varying)::text, ('dingin'::character varying)::text]))`),]);

export const regions = pgTable("regions", {
	code: varchar({ length: 13 }).primaryKey(),
	parentCode: varchar("parent_code", { length: 13 }),
	level: smallint().notNull(),
	name: varchar({ length: 100 }).notNull(),
	postalCode: varchar("postal_code", { length: 5 }),
}, (table) => [
	index("regions_name_index").using("btree", table.name.asc().nullsLast()),
	index("regions_parent_code_index").using("btree", table.parentCode.asc().nullsLast()),
]);

export const roleHasPermissions = pgTable("role_has_permissions", {
	permissionId: bigint("permission_id", { mode: 'number' }).notNull(),
	roleId: bigint("role_id", { mode: 'number' }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.permissionId, table.roleId], name: "role_has_permissions_pkey"}),
	foreignKey({
		columns: [table.permissionId],
		foreignColumns: [permissions.id],
		name: "role_has_permissions_permission_id_foreign"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.roleId],
		foreignColumns: [roles.id],
		name: "role_has_permissions_role_id_foreign"
	}).onDelete("cascade"),
]);

export const roles = pgTable("roles", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	name: varchar({ length: 255 }).notNull(),
	guardName: varchar("guard_name", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	description: varchar({ length: 255 }),
}, (table) => [
	unique("roles_name_guard_name_unique").on(table.name, table.guardName),]);

export const sessions = pgTable("sessions", {
	id: varchar({ length: 255 }).primaryKey(),
	userId: bigint("user_id", { mode: 'number' }),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: text("user_agent"),
	payload: text().notNull(),
	lastActivity: integer("last_activity").notNull(),
}, (table) => [
	index("sessions_last_activity_index").using("btree", table.lastActivity.asc().nullsLast()),
	index("sessions_user_id_index").using("btree", table.userId.asc().nullsLast()),
]);

export const settings = pgTable("settings", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	branchId: bigint("branch_id", { mode: 'number' }),
	key: varchar({ length: 80 }).notNull(),
	value: text(),
	type: varchar({ length: 20 }).default("string").notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.branchId],
		foreignColumns: [branches.id],
		name: "settings_branch_id_foreign"
	}).onDelete("cascade"),
	unique("settings_branch_id_key_unique").on(table.branchId, table.key),]);

export const shipments = pgTable("shipments", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	orderId: bigint("order_id", { mode: 'number' }).notNull(),
	courierCompany: varchar("courier_company", { length: 40 }).notNull(),
	courierType: varchar("courier_type", { length: 40 }).notNull(),
	courierName: varchar("courier_name", { length: 255 }),
	courierServiceName: varchar("courier_service_name", { length: 255 }),
	price: bigint({ mode: 'number' }).notNull(),
	biteshipOrderId: varchar("biteship_order_id", { length: 255 }),
	trackingId: varchar("tracking_id", { length: 255 }),
	waybillId: varchar("waybill_id", { length: 255 }),
	courierLink: varchar("courier_link", { length: 255 }),
	status: varchar({ length: 40 }),
	history: jsonb(),
	rawResponse: jsonb("raw_response"),
	shippedAt: timestamp("shipped_at", { precision: 0 }),
	deliveredAt: timestamp("delivered_at", { precision: 0 }),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.orderId],
		foreignColumns: [orders.id],
		name: "shipments_order_id_foreign"
	}).onDelete("restrict"),
	index("shipments_tracking_id_index").using("btree", table.trackingId.asc().nullsLast()),
	unique("shipments_order_id_unique").on(table.orderId),]);

export const stockTransfers = pgTable("stock_transfers", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	code: customType({ dataType: () => 'citext' })().notNull(),
	fromBranchId: bigint("from_branch_id", { mode: 'number' }).notNull(),
	toBranchId: bigint("to_branch_id", { mode: 'number' }).notNull(),
	productId: bigint("product_id", { mode: 'number' }).notNull(),
	quantity: integer().notNull(),
	status: varchar({ length: 255 }).default("diminta").notNull(),
	requestedBy: bigint("requested_by", { mode: 'number' }),
	note: varchar({ length: 255 }),
	batchesShipped: jsonb("batches_shipped"),
	shippedAt: timestamp("shipped_at", { precision: 0 }),
	receivedAt: timestamp("received_at", { precision: 0 }),
	cancelledAt: timestamp("cancelled_at", { precision: 0 }),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.fromBranchId],
		foreignColumns: [branches.id],
		name: "stock_transfers_from_branch_id_foreign"
	}).onDelete("restrict"),
	foreignKey({
		columns: [table.productId],
		foreignColumns: [products.id],
		name: "stock_transfers_product_id_foreign"
	}).onDelete("restrict"),
	foreignKey({
		columns: [table.requestedBy],
		foreignColumns: [users.id],
		name: "stock_transfers_requested_by_foreign"
	}).onDelete("set null"),
	foreignKey({
		columns: [table.toBranchId],
		foreignColumns: [branches.id],
		name: "stock_transfers_to_branch_id_foreign"
	}).onDelete("restrict"),
	index("stock_transfers_from_branch_id_status_index").using("btree", table.fromBranchId.asc().nullsLast(), table.status.asc().nullsLast()),
	index("stock_transfers_status_created_at_index").using("btree", table.status.asc().nullsLast(), table.createdAt.asc().nullsLast()),
	index("stock_transfers_to_branch_id_status_index").using("btree", table.toBranchId.asc().nullsLast(), table.status.asc().nullsLast()),
	unique("stock_transfers_code_unique").on(table.code),check("stock_transfers_status_check", sql`((status)::text = ANY (ARRAY[('diminta'::character varying)::text, ('dikirim'::character varying)::text, ('diterima'::character varying)::text, ('dibatalkan'::character varying)::text]))`),]);

export const subscribers = pgTable("subscribers", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	email: customType({ dataType: () => 'citext' })().notNull(),
	status: varchar({ length: 20 }).default("berlangganan").notNull(),
	subscribedAt: timestamp("subscribed_at", { precision: 0 }),
	unsubscribedAt: timestamp("unsubscribed_at", { precision: 0 }),
	unsubscribeToken: varchar("unsubscribe_token", { length: 64 }).notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
}, (table) => [
	index("subscribers_status_index").using("btree", table.status.asc().nullsLast()),
	unique("subscribers_email_unique").on(table.email),	unique("subscribers_unsubscribe_token_unique").on(table.unsubscribeToken),]);

export const suppliers = pgTable("suppliers", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	code: customType({ dataType: () => 'citext' })().notNull(),
	name: varchar({ length: 255 }).notNull(),
	contactPerson: varchar("contact_person", { length: 255 }),
	email: varchar({ length: 255 }),
	phone: varchar({ length: 30 }),
	licenseNumber: varchar("license_number", { length: 60 }),
	addressLine: varchar("address_line", { length: 255 }),
	kota: varchar({ length: 80 }),
	provinsi: varchar({ length: 80 }),
	paymentTermDays: smallint("payment_term_days").default(30).notNull(),
	status: varchar({ length: 255 }).default("aktif").notNull(),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	deletedAt: timestamp("deleted_at", { precision: 0 }),
}, (table) => [
	index("suppliers_status_index").using("btree", table.status.asc().nullsLast()),
	unique("suppliers_code_unique").on(table.code),	unique("suppliers_license_number_unique").on(table.licenseNumber),check("suppliers_status_check", sql`((status)::text = ANY (ARRAY[('aktif'::character varying)::text, ('nonaktif'::character varying)::text]))`),]);

export const users = pgTable("users", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	name: varchar({ length: 255 }).notNull(),
	email: customType({ dataType: () => 'citext' })().notNull(),
	emailVerifiedAt: timestamp("email_verified_at", { precision: 0 }),
	password: varchar({ length: 255 }).notNull(),
	rememberToken: varchar("remember_token", { length: 100 }),
	createdAt: timestamp("created_at", { precision: 0 }),
	updatedAt: timestamp("updated_at", { precision: 0 }),
	branchId: bigint("branch_id", { mode: 'number' }),
	phone: varchar({ length: 30 }),
	isActive: boolean("is_active").default(true).notNull(),
	lastLoginAt: timestamp("last_login_at", { precision: 0 }),
	deletedAt: timestamp("deleted_at", { precision: 0 }),
	twoFactorSecret: text("two_factor_secret"),
	twoFactorRecoveryCodes: text("two_factor_recovery_codes"),
	twoFactorConfirmedAt: timestamp("two_factor_confirmed_at", { precision: 0 }),
}, (table) => [
	foreignKey({
		columns: [table.branchId],
		foreignColumns: [branches.id],
		name: "users_branch_id_foreign"
	}).onDelete("set null"),
	index("users_branch_id_is_active_index").using("btree", table.branchId.asc().nullsLast(), table.isActive.asc().nullsLast()),
	unique("users_email_unique").on(table.email),]);
