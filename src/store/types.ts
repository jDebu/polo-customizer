export type SleeveType = 'short' | 'long'
export type PaymentMethod = 'yape' | 'plin'
export type OrderStatus =
  | 'pending_validation'
  | 'confirmed'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'rejected'

/** Posición y tamaño en CM DE REFERENCIA (talla M), relativos a la esquina sup. izq. del límite del molde. */
export interface ImageState {
  x: number         // cm ref desde borde izq. del límite
  y: number         // cm ref desde borde sup. del límite
  width: number     // cm ref
  height: number    // cm ref
  rotation: number  // grados
  flipH: boolean
}

export type { PanelId } from '../data/molds'
import type { PanelId } from '../data/molds'

export interface PlacedImage {
  id: string
  src: string
  file: File | null
  panel: PanelId
  state: ImageState
  natW: number      // píxeles originales de la imagen
  natH: number
}

export interface DesignConfig {
  poloColor: string
  sleeveType: SleeveType
  popularDesignId: string | null
  placedImages: PlacedImage[]   // up to 6
  activePanel: PanelId
  activeImageId: string | null
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
  designImageUrls: string[]  // imgbb URLs of all uploaded design images
  renderUrls: string[]       // imgbb URLs: [front, back, right, left]
}

export interface PopularDesign {
  id: string
  name: string
  thumbnailUrl: string
  designUrl: string
  tags: string[]
}

export type InteractionMode = 'transform' | 'rotate'
