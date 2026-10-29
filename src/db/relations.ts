import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	branches: {
		usersViaAuditLogs: r.many.users({
			from: r.branches.id.through(r.auditLogs.branchId),
			to: r.users.id.through(r.auditLogs.userId),
			alias: "branches_id_users_id_via_auditLogs"
		}),
		auditLogs: r.many.auditLogs(),
		productsViaBranchStocks: r.many.products({
			from: r.branches.id.through(r.branchStocks.branchId),
			to: r.products.id.through(r.branchStocks.productId),
			alias: "branches_id_products_id_via_branchStocks"
		}),
		branchStocks: r.many.branchStocks(),
		carts: r.many.carts(),
		coupons: r.many.coupons({
			from: r.branches.id.through(r.couponBranch.branchId),
			to: r.coupons.id.through(r.couponBranch.couponId)
		}),
		couponBranches: r.many.couponBranch(),
		customers: r.many.customers(),
		productsViaInventoryBatches: r.many.products({
			from: r.branches.id.through(r.inventoryBatches.branchId),
			to: r.products.id.through(r.inventoryBatches.productId),
			alias: "branches_id_products_id_via_inventoryBatches"
		}),
		inventoryBatches: r.many.inventoryBatches(),
		inventoryMovements: r.many.inventoryMovements(),
		orders: r.many.orders(),
		settings: r.many.settings(),
		stockTransfersFromBranchId: r.many.stockTransfers({
			alias: "stockTransfers_fromBranchId_branches_id"
		}),
		stockTransfersToBranchId: r.many.stockTransfers({
			alias: "stockTransfers_toBranchId_branches_id"
		}),
		usersBranchId: r.many.users({
			alias: "users_branchId_branches_id"
		}),
	},
	users: {
		branches: r.many.branches({
			alias: "branches_id_users_id_via_auditLogs"
		}),
		auditLogs: r.many.auditLogs(),
		chatConversations: r.many.chatConversations(),
		chatMessages: r.many.chatMessages(),
		inventoryMovements: r.many.inventoryMovements(),
		orders: r.many.orders(),
		stockTransfers: r.many.stockTransfers(),
		branch: r.one.branches({
			from: r.users.branchId,
			to: r.branches.id,
			alias: "users_branchId_branches_id"
		}),
	},
	auditLogs: {
		branch: r.one.branches({
			from: r.auditLogs.branchId,
			to: r.branches.id
		}),
		user: r.one.users({
			from: r.auditLogs.userId,
			to: r.users.id
		}),
	},
	products: {
		branchesViaBranchStocks: r.many.branches({
			alias: "branches_id_products_id_via_branchStocks"
		}),
		branchStocks: r.many.branchStocks(),
		carts: r.many.carts(),
		cartItems: r.many.cartItems(),
		branchesViaInventoryBatches: r.many.branches({
			alias: "branches_id_products_id_via_inventoryBatches"
		}),
		inventoryBatches: r.many.inventoryBatches(),
		inventoryMovements: r.many.inventoryMovements(),
		orders: r.many.orders(),
		orderItems: r.many.orderItems(),
		productImages: r.many.productImages(),
		category: r.one.categories({
			from: r.products.categoryId,
			to: r.categories.id
		}),
		supplier: r.one.suppliers({
			from: r.products.supplierId,
			to: r.suppliers.id
		}),
		stockTransfers: r.many.stockTransfers(),
	},
	branchStocks: {
		branch: r.one.branches({
			from: r.branchStocks.branchId,
			to: r.branches.id
		}),
		product: r.one.products({
			from: r.branchStocks.productId,
			to: r.products.id
		}),
	},
	carts: {
		products: r.many.products({
			from: r.carts.id.through(r.cartItems.cartId),
			to: r.products.id.through(r.cartItems.productId)
		}),
		cartItems: r.many.cartItems(),
		branch: r.one.branches({
			from: r.carts.branchId,
			to: r.branches.id
		}),
		coupon: r.one.coupons({
			from: r.carts.couponId,
			to: r.coupons.id
		}),
		customerAddress: r.one.customerAddresses({
			from: r.carts.customerAddressId,
			to: r.customerAddresses.id
		}),
		customer: r.one.customers({
			from: r.carts.customerId,
			to: r.customers.id
		}),
	},
	cartItems: {
		cart: r.one.carts({
			from: r.cartItems.cartId,
			to: r.carts.id
		}),
		product: r.one.products({
			from: r.cartItems.productId,
			to: r.products.id
		}),
	},
	coupons: {
		carts: r.many.carts(),
		branches: r.many.branches(),
		couponBranches: r.many.couponBranch(),
		orders: r.many.orders(),
	},
	customerAddresses: {
		carts: r.many.carts(),
		customer: r.one.customers({
			from: r.customerAddresses.customerId,
			to: r.customers.id
		}),
	},
	customers: {
		carts: r.one.carts(),
		customerAddresses: r.many.customerAddresses(),
		branch: r.one.branches({
			from: r.customers.preferredBranchId,
			to: r.branches.id
		}),
		orders: r.many.orders(),
	},
	categories: {
		category: r.one.categories({
			from: r.categories.parentId,
			to: r.categories.id,
			alias: "categories_parentId_categories_id"
		}),
		categories: r.many.categories({
			alias: "categories_parentId_categories_id"
		}),
		suppliers: r.many.suppliers({
			from: r.categories.id.through(r.products.categoryId),
			to: r.suppliers.id.through(r.products.supplierId)
		}),
		products: r.many.products(),
	},
	chatConversations: {
		users: r.many.users({
			from: r.chatConversations.id.through(r.chatMessages.chatConversationId),
			to: r.users.id.through(r.chatMessages.userId)
		}),
		chatMessages: r.many.chatMessages(),
	},
	chatMessages: {
		chatConversation: r.one.chatConversations({
			from: r.chatMessages.chatConversationId,
			to: r.chatConversations.id
		}),
		user: r.one.users({
			from: r.chatMessages.userId,
			to: r.users.id
		}),
	},
	couponBranch: {
		branch: r.one.branches({
			from: r.couponBranch.branchId,
			to: r.branches.id
		}),
		coupon: r.one.coupons({
			from: r.couponBranch.couponId,
			to: r.coupons.id
		}),
	},
	inventoryBatches: {
		branch: r.one.branches({
			from: r.inventoryBatches.branchId,
			to: r.branches.id
		}),
		product: r.one.products({
			from: r.inventoryBatches.productId,
			to: r.products.id
		}),
		inventoryMovements: r.many.inventoryMovements(),
	},
	inventoryMovements: {
		branch: r.one.branches({
			from: r.inventoryMovements.branchId,
			to: r.branches.id
		}),
		inventoryBatch: r.one.inventoryBatches({
			from: r.inventoryMovements.inventoryBatchId,
			to: r.inventoryBatches.id
		}),
		product: r.one.products({
			from: r.inventoryMovements.productId,
			to: r.products.id
		}),
		user: r.one.users({
			from: r.inventoryMovements.userId,
			to: r.users.id
		}),
	},
	modelHasPermissions: {
		permission: r.one.permissions({
			from: r.modelHasPermissions.permissionId,
			to: r.permissions.id
		}),
	},
	permissions: {
		modelHasPermissions: r.many.modelHasPermissions(),
		roles: r.many.roles({
			from: r.permissions.id.through(r.roleHasPermissions.permissionId),
			to: r.roles.id.through(r.roleHasPermissions.roleId)
		}),
		roleHasPermissions: r.many.roleHasPermissions(),
	},
	modelHasRoles: {
		role: r.one.roles({
			from: r.modelHasRoles.roleId,
			to: r.roles.id
		}),
	},
	roles: {
		modelHasRoles: r.many.modelHasRoles(),
		permissions: r.many.permissions(),
		roleHasPermissions: r.many.roleHasPermissions(),
	},
	newsletters: {
		subscribers: r.many.subscribers({
			from: r.newsletters.id.through(r.newsletterDeliveries.newsletterId),
			to: r.subscribers.id.through(r.newsletterDeliveries.subscriberId)
		}),
		newsletterDeliveries: r.many.newsletterDeliveries(),
	},
	subscribers: {
		newsletters: r.many.newsletters(),
		newsletterDeliveries: r.many.newsletterDeliveries(),
	},
	newsletterDeliveries: {
		newsletter: r.one.newsletters({
			from: r.newsletterDeliveries.newsletterId,
			to: r.newsletters.id
		}),
		subscriber: r.one.subscribers({
			from: r.newsletterDeliveries.subscriberId,
			to: r.subscribers.id
		}),
	},
	orders: {
		products: r.many.products({
			from: r.orders.id.through(r.orderItems.orderId),
			to: r.products.id.through(r.orderItems.productId)
		}),
		orderItems: r.many.orderItems(),
		branch: r.one.branches({
			from: r.orders.branchId,
			to: r.branches.id
		}),
		coupon: r.one.coupons({
			from: r.orders.couponId,
			to: r.coupons.id
		}),
		customer: r.one.customers({
			from: r.orders.customerId,
			to: r.customers.id
		}),
		user: r.one.users({
			from: r.orders.handedOverBy,
			to: r.users.id
		}),
		payments: r.many.payments(),
		shipments: r.one.shipments(),
	},
	orderItems: {
		order: r.one.orders({
			from: r.orderItems.orderId,
			to: r.orders.id
		}),
		product: r.one.products({
			from: r.orderItems.productId,
			to: r.products.id
		}),
	},
	payments: {
		order: r.one.orders({
			from: r.payments.orderId,
			to: r.orders.id
		}),
	},
	productImages: {
		product: r.one.products({
			from: r.productImages.productId,
			to: r.products.id
		}),
	},
	suppliers: {
		categories: r.many.categories(),
		products: r.many.products(),
	},
	roleHasPermissions: {
		permission: r.one.permissions({
			from: r.roleHasPermissions.permissionId,
			to: r.permissions.id
		}),
		role: r.one.roles({
			from: r.roleHasPermissions.roleId,
			to: r.roles.id
		}),
	},
	settings: {
		branch: r.one.branches({
			from: r.settings.branchId,
			to: r.branches.id
		}),
	},
	shipments: {
		order: r.one.orders({
			from: r.shipments.orderId,
			to: r.orders.id
		}),
	},
	stockTransfers: {
		branchFromBranchId: r.one.branches({
			from: r.stockTransfers.fromBranchId,
			to: r.branches.id,
			alias: "stockTransfers_fromBranchId_branches_id"
		}),
		product: r.one.products({
			from: r.stockTransfers.productId,
			to: r.products.id
		}),
		user: r.one.users({
			from: r.stockTransfers.requestedBy,
			to: r.users.id
		}),
		branchToBranchId: r.one.branches({
			from: r.stockTransfers.toBranchId,
			to: r.branches.id,
			alias: "stockTransfers_toBranchId_branches_id"
		}),
	},
}))