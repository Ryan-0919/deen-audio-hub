# 商城 Prisma 建模初稿

## 1. 文档目的

本文件用于把前一版商城数据库设计草案进一步收敛为接近可执行的 Prisma 建模方案。

本稿的定位是：

- 命名统一
- 枚举统一
- 主外键关系清晰
- 方便下一步直接合并进现有 `prisma/schema.prisma`

本稿暂不直接修改现有数据库结构，仅作为建模实施前的落地稿。

## 2. 设计原则

- 复用现有 `User`、`Course`、`UserCoursePermission`
- 商城独立维护商品、订单、支付、履约、物流
- 商品和课程是绑定关系，不是同一张表
- 历史订单必须保留快照字段
- 支持纯虚拟、纯实物、组合商品

## 3. 推荐枚举

```prisma
enum ShopProductType {
  virtual
  physical
  hybrid
}

enum ShopProductStatus {
  draft
  on_sale
  off_sale
}

enum ShopOrderStatus {
  pending_payment
  paid
  partially_fulfilled
  completed
  cancelled
  refunding
  refunded
}

enum ShopPaymentStatus {
  unpaid
  paid
  failed
  refunded
}

enum ShopDigitalFulfillmentStatus {
  pending
  success
  failed
}

enum ShopShipmentStatus {
  pending
  shipped
  in_transit
  signed
  failed
}

enum ShopRefundStatus {
  pending
  approved
  rejected
  completed
  failed
}
```

## 4. 分类与商品模型

### 4.1 ShopCategory

```prisma
model ShopCategory {
  id        String        @id @default(cuid())
  name      String        @unique @db.VarChar(100)
  sortOrder Int           @default(0)
  status    Boolean       @default(true)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  products  ShopProduct[]

  @@index([sortOrder])
}
```

### 4.2 ShopProduct

```prisma
model ShopProduct {
  id               String             @id @default(cuid())
  categoryId       String?
  name             String             @db.VarChar(191)
  subtitle         String?            @db.VarChar(255)
  coverUrl         String             @db.VarChar(500)
  coverObjectKey   String?            @db.VarChar(255)
  type             ShopProductType
  status           ShopProductStatus  @default(draft)
  description      String?            @db.LongText
  detailContent    String?            @db.LongText
  requiresShipping Boolean            @default(false)
  sortOrder        Int                @default(0)
  salesCount       Int                @default(0)
  isDeleted        Boolean            @default(false)
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  category         ShopCategory?      @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  images           ShopProductImage[]
  skus             ShopSku[]
  courses          ShopProductCourse[]
  orderItems       ShopOrderItem[]
  cartItems        ShopCartItem[]

  @@index([categoryId, status, sortOrder])
  @@index([type, status, sortOrder])
}
```

### 4.3 ShopProductImage

```prisma
model ShopProductImage {
  id            String      @id @default(cuid())
  productId     String
  imageUrl      String      @db.VarChar(500)
  imageObjectKey String?    @db.VarChar(255)
  sortOrder     Int         @default(0)
  createdAt     DateTime    @default(now())

  product       ShopProduct @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId, sortOrder])
}
```

### 4.4 ShopProductCourse

```prisma
model ShopProductCourse {
  id        String      @id @default(cuid())
  productId String
  courseId  String
  createdAt DateTime    @default(now())

  product   ShopProduct @relation(fields: [productId], references: [id], onDelete: Cascade)
  course    Course      @relation(fields: [courseId], references: [id], onDelete: Restrict)

  @@unique([productId, courseId])
  @@index([courseId])
}
```

### 4.5 ShopSku

```prisma
model ShopSku {
  id                String      @id @default(cuid())
  productId         String
  name              String      @db.VarChar(191)
  price             Decimal     @db.Decimal(10, 2)
  originalPrice     Decimal?    @db.Decimal(10, 2)
  stock             Int         @default(0)
  weight            Int?        @default(0)
  isDefault         Boolean     @default(false)
  status            Boolean     @default(true)
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  product           ShopProduct @relation(fields: [productId], references: [id], onDelete: Cascade)
  cartItems         ShopCartItem[]
  orderItems        ShopOrderItem[]

  @@index([productId, status])
}
```

## 5. 地址与购物车模型

### 5.1 UserAddress

```prisma
model UserAddress {
  id         String   @id @default(cuid())
  userId     String
  name       String   @db.VarChar(50)
  phone      String   @db.VarChar(20)
  province   String   @db.VarChar(50)
  city       String   @db.VarChar(50)
  district   String   @db.VarChar(50)
  address    String   @db.VarChar(255)
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isDefault])
}
```

### 5.2 ShopCartItem

```prisma
model ShopCartItem {
  id        String      @id @default(cuid())
  userId    String
  productId String
  skuId     String
  quantity  Int         @default(1)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  product   ShopProduct @relation(fields: [productId], references: [id], onDelete: Cascade)
  sku       ShopSku     @relation(fields: [skuId], references: [id], onDelete: Cascade)

  @@unique([userId, skuId])
  @@index([userId, updatedAt])
}
```

## 6. 订单与支付模型

### 6.1 ShopOrder

```prisma
model ShopOrder {
  id                String                @id @default(cuid())
  orderNo           String                @unique @db.VarChar(50)
  userId            String
  status            ShopOrderStatus       @default(pending_payment)
  paymentStatus     ShopPaymentStatus     @default(unpaid)
  totalAmount       Decimal               @db.Decimal(10, 2)
  payAmount         Decimal               @db.Decimal(10, 2)
  freightAmount     Decimal               @default(0) @db.Decimal(10, 2)
  remark            String?               @db.VarChar(255)
  receiverName      String?               @db.VarChar(50)
  receiverPhone     String?               @db.VarChar(20)
  receiverProvince  String?               @db.VarChar(50)
  receiverCity      String?               @db.VarChar(50)
  receiverDistrict  String?               @db.VarChar(50)
  receiverAddress   String?               @db.VarChar(255)
  paidAt            DateTime?
  cancelledAt       DateTime?
  completedAt       DateTime?
  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt

  user              User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  items             ShopOrderItem[]
  payments          ShopPaymentRecord[]
  digitalFulfillments ShopDigitalFulfillment[]
  shipments         ShopShipment[]
  refunds           ShopRefundRecord[]

  @@index([userId, createdAt])
  @@index([status, createdAt])
  @@index([paymentStatus, createdAt])
}
```

### 6.2 ShopOrderItem

```prisma
model ShopOrderItem {
  id                    String      @id @default(cuid())
  orderId               String
  productId             String
  skuId                 String
  productNameSnapshot   String      @db.VarChar(191)
  productTypeSnapshot   ShopProductType
  coverSnapshot         String      @db.VarChar(500)
  priceSnapshot         Decimal     @db.Decimal(10, 2)
  originalPriceSnapshot Decimal?    @db.Decimal(10, 2)
  quantity              Int         @default(1)
  requiresShipping      Boolean     @default(false)
  courseIdsSnapshot     String?     @db.LongText
  createdAt             DateTime    @default(now())

  order                 ShopOrder   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product               ShopProduct @relation(fields: [productId], references: [id], onDelete: Restrict)
  sku                   ShopSku     @relation(fields: [skuId], references: [id], onDelete: Restrict)
  digitalFulfillments   ShopDigitalFulfillment[]
  shipmentItems         ShopShipmentItem[]
  refunds               ShopRefundRecord[]

  @@index([orderId])
  @@index([productId])
  @@index([skuId])
}
```

### 6.3 ShopPaymentRecord

```prisma
model ShopPaymentRecord {
  id            String            @id @default(cuid())
  orderId       String
  channel       String            @db.VarChar(50)
  status        ShopPaymentStatus @default(unpaid)
  transactionNo String?           @db.VarChar(100)
  payAmount     Decimal           @db.Decimal(10, 2)
  paidAt        DateTime?
  rawPayload    String?           @db.LongText
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  order         ShopOrder         @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId, createdAt])
  @@index([transactionNo])
}
```

## 7. 履约与物流模型

### 7.1 ShopDigitalFulfillment

```prisma
model ShopDigitalFulfillment {
  id           String                       @id @default(cuid())
  orderId      String
  orderItemId  String
  userId       String
  status       ShopDigitalFulfillmentStatus @default(pending)
  grantType    String                       @db.VarChar(50)
  grantPayload String?                      @db.LongText
  grantedAt    DateTime?
  errorMessage String?                      @db.VarChar(500)
  createdAt    DateTime                     @default(now())
  updatedAt    DateTime                     @updatedAt

  order        ShopOrder                    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderItem    ShopOrderItem                @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  user         User                         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([orderId, status])
  @@index([orderItemId])
  @@index([userId, status])
}
```

### 7.2 ShopShipment

```prisma
model ShopShipment {
  id          String             @id @default(cuid())
  orderId     String
  status      ShopShipmentStatus @default(pending)
  company     String?            @db.VarChar(100)
  trackingNo  String?            @db.VarChar(100)
  shippedAt   DateTime?
  signedAt    DateTime?
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  order       ShopOrder          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  items       ShopShipmentItem[]
  tracks      ShopShipmentTrack[]

  @@index([orderId])
  @@index([status, createdAt])
  @@index([trackingNo])
}
```

### 7.3 ShopShipmentItem

```prisma
model ShopShipmentItem {
  id          String        @id @default(cuid())
  shipmentId  String
  orderItemId String
  quantity    Int           @default(1)

  shipment    ShopShipment  @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  orderItem   ShopOrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)

  @@index([shipmentId])
  @@index([orderItemId])
}
```

### 7.4 ShopShipmentTrack

```prisma
model ShopShipmentTrack {
  id         String       @id @default(cuid())
  shipmentId String
  content    String       @db.VarChar(255)
  location   String?      @db.VarChar(100)
  trackTime  DateTime
  createdAt  DateTime     @default(now())

  shipment   ShopShipment @relation(fields: [shipmentId], references: [id], onDelete: Cascade)

  @@index([shipmentId, trackTime])
}
```

## 8. 退款模型

```prisma
model ShopRefundRecord {
  id            String           @id @default(cuid())
  orderId       String
  orderItemId   String?
  status        ShopRefundStatus @default(pending)
  refundAmount  Decimal          @db.Decimal(10, 2)
  reason        String?          @db.VarChar(255)
  resultMessage String?          @db.VarChar(500)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  order         ShopOrder        @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderItem     ShopOrderItem?   @relation(fields: [orderItemId], references: [id], onDelete: SetNull)

  @@index([orderId, createdAt])
  @@index([status, createdAt])
}
```

## 9. 与现有模型关系补充

为了让 Prisma 关系完整，现有表中建议补充以下反向关系字段。

### User 增加

```prisma
addresses           UserAddress[]
cartItems           ShopCartItem[]
shopOrders          ShopOrder[]
digitalFulfillments ShopDigitalFulfillment[]
```

### Course 增加

```prisma
shopProducts ShopProductCourse[]
```

## 10. 一期最小落库范围

如果要控制复杂度，一期建议先落以下模型：

- `ShopCategory`
- `ShopProduct`
- `ShopProductImage`
- `ShopProductCourse`
- `ShopSku`
- `UserAddress`
- `ShopCartItem`
- `ShopOrder`
- `ShopOrderItem`
- `ShopPaymentRecord`
- `ShopDigitalFulfillment`
- `ShopShipment`
- `ShopShipmentTrack`

`ShopShipmentItem` 和 `ShopRefundRecord` 可以一期一起落，也可以根据开发节奏略后。

## 11. 实施建议

实施顺序建议如下：

1. 先把枚举和核心模型加进 `schema.prisma`
2. 执行 `prisma generate`
3. 执行 `prisma db push`
4. 先实现后台商品和订单基础接口
5. 再实现用户端购物车和下单接口
6. 最后接支付与履约

## 12. 下一步建议

本文件之后，建议继续新增：

- `05-商城页面原型文档.md`
- `06-商城接口设计文档.md`
- `07-商城一期开发排期.md`
