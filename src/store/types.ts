export type SleeveType = 'short' | 'long'
export type PaymentMethod = 'yape' | 'plin'
export type OrderStatus =
  | 'pending_validation'
  | 'confirmed'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'rejected'

export interface ImageState {
  x: number         // canvas px from left
  y: number         // canvas px from top
  width: number     // px
  height: number    // px
  rotation: number  // degrees
  flipH: boolean
}

export interface DesignConfig {
  poloColor: string
  sleeveType: SleeveType
  userImageSrc: string | null    // base64 or URL for canvas draw
  userImageFile: File | null     // original file for validation
  frontImageState: ImageState
  backImageState: ImageState | null  // only for long sleeve
  popularDesignId: string | null
}

export interface OrderItem {
  size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'
  quantity: number
  pricePerUnit: number
}

export interface DeliveryInfo {
  recipientName: string
  dni: string
  phone: string
  department: string
  province: string
  district: string
  address: string
  reference: string
  rate: number
}

export interface PaymentInfo {
  method: PaymentMethod
  voucherFile: File | null
  voucherUrl: string | null  // ImgBB URL after upload
}

export interface Order {
  orderId: string
  createdAt: string
  design: DesignConfig
  item: OrderItem
  delivery: DeliveryInfo
  payment: PaymentInfo
  status: OrderStatus
  statusUpdatedAt: string
  estimatedDelivery: string | null
  adminNotes: string
}

export interface PopularDesign {
  id: string
  name: string
  thumbnailUrl: string
  designUrl: string
  tags: string[]
}

export type InteractionMode = 'transform' | 'rotate'
