export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  images: string[];
  category: string;
  rating: number;
  reviewCount: number;
  stock: number;
  sellerId: string;
  sellerName: string;
  reviews: Review[];
  // Campos añadidos para BD Compliance
  type?: "producto" | "servicio";
  durationMin?: number;
  availability?: string;
  location?: string;
  status?: "Aprobado" | "En revision" | "Rechazado";
  // Campos añadidos para Features 4-5 (galería, sucursal)
  sku?: string;
  publicationDate?: string;
  branchName?: string;
  branchAddress?: string;
  businessId?: string;
  // Campos para descuentos reales de BD
  originalPrice?: number;
  discountPercent?: number;
  agendaSlots?: ServiceAgendaSlot[];
  // Campos para breadcrumb jerárquico de categorías
  categoryId?: string;
  categoryPath?: Array<{ id: string; name: string }>;
}

export interface ServiceAgendaSlot {
  id: string;
  start: string;
  end: string;
  status: string;
  branchName?: string;
  branchAddress?: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  verifiedPurchase?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  // Campos para servicios
  agendaSlotId?: string;
  selectedDate?: string;
  selectedTime?: string;
  selectedEndTime?: string;
}

export interface OrderCoupon {
  codigo_cupon: string;
  porcentaje_descuento: number;
  descuento_aplicado: number;
  items_afectados?: number;
}

export interface Order {
  id: string;
  folio: string;
  date: string;
  items: CartItem[];
  total: number;
  status: string;
  buyerName: string;
  buyerId: string;
  address: string;
  paymentMethod?: string;
  cupon?: OrderCoupon | OrderCoupon[] | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "comprador" | "vendedor" | "admin";
  registrationDate: string;
  status: "Activo" | "Bloqueado";
  phone?: string;
  avatar?: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedName: string;
  reason: string;
  category: string;
  date: string;
  status:
    | "Pendiente"
    | "Revisado"
    | "Resuelto"
    | "Desestimado"
    | "Advertencia formal"
    | "Suspensión temporal"
    | "Bloqueo permanente"
    | "Contenido eliminado";
  description: string;
}

export interface Bundle {
  id: string;
  name: string;
  products: Product[];
  bundlePrice: number;
  originalTotal: number;
  sellerId: string;
}

export interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  provider: string; // "Visa", "Mastercard"
  lastFour: string;
  expiry: string;
  isDefault?: boolean;
}

export interface BusinessProfile {
  id: string;
  sellerId: string;
  businessName: string;
  rfc: string;
  address: string;
  lat: number;
  lng: number;
  logo?: string;
}

export interface Discount {
  id: string;
  code: string;
  percentage: number;
  validUntil: string;
}

export const categories = [
  { id: "cumpleanos", name: "Cumpleanos", icon: "🎂" },
  { id: "bodas", name: "Bodas", icon: "💒" },
  { id: "baby-shower", name: "Baby Shower", icon: "👶" },
  { id: "graduacion", name: "Graduacion", icon: "🎓" },
  { id: "halloween", name: "Halloween", icon: "🎃" },
  { id: "navidad", name: "Navidad", icon: "🎄" },
  { id: "xv-anos", name: "XV Anos", icon: "👑" },
  { id: "fiestas-infantiles", name: "Fiestas Infantiles", icon: "🎈" },
  // Categorías de servicios
  { id: "fotografia-evento", name: "Fotografia de Eventos", icon: "📸" },
  { id: "musica-dj", name: "Musica y DJ", icon: "🎵" },
  { id: "catering-servicio", name: "Catering", icon: "🍽️" },
  { id: "decoracion-profesional", name: "Decoracion Profesional", icon: "🎨" },
  { id: "animacion-fiestas", name: "Animacion para Fiestas", icon: "🎪" },
  { id: "transporte-evento", name: "Transporte para Eventos", icon: "🚐" },
  { id: "ilumincacion-evento", name: "Iluminacion de Eventos", icon: "💡" },
  { id: "sonido-evento", name: "Equipo de Sonido", icon: "🔊" },
];

export const products: Product[] = [
  {
    id: "p1",
    name: "Kit de Decoracion Fiesta de Cumpleanos Premium",
    description: "Kit completo con globos, guirnaldas, banderines y centros de mesa para una fiesta de cumpleanos inolvidable. Incluye 50 globos de colores, 3 guirnaldas de papel, banner de 'Feliz Cumpleanos' y confeti metalico.",
    price: 459.99,
    originalPrice: 599.99,
    image: "https://images.unsplash.com/photo-1772683530743-000edbd6ebc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjZWxlYnJhdGlvbiUyMHBhcnR5JTIwc3VwcGxpZXMlMjBkZWNvcmF0aW9uc3xlbnwxfHx8fDE3NzI3NjUwMTV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1772683530743-000edbd6ebc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjZWxlYnJhdGlvbiUyMHBhcnR5JTIwc3VwcGxpZXMlMjBkZWNvcmF0aW9uc3xlbnwxfHx8fDE3NzI3NjUwMTV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      "https://images.unsplash.com/photo-1693651199295-2dee5af42919?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xvcmZ1bCUyMGJhbGxvb25zJTIwcGFydHl8ZW58MXx8fHwxNzcyNzMzODIxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "cumpleanos",
    rating: 4.5,
    reviewCount: 128,
    stock: 45,
    sellerId: "s1",
    sellerName: "FiestaMax",
    reviews: [
      { id: "r1", userId: "u1", userName: "Maria G.", rating: 5, comment: "Excelente calidad, todo llego completo y a tiempo.", date: "2026-02-15" },
      { id: "r2", userId: "u2", userName: "Carlos R.", rating: 4, comment: "Muy bonitos los globos, el banner es de buena calidad.", date: "2026-02-10" },
    ],
    type: "producto",
    status: "Aprobado"
  },
  {
    id: "p2",
    name: "Globos de Helio Metalicos Surtidos (50 piezas)",
    description: "Paquete de 50 globos metalicos de alta calidad en colores surtidos. Perfectos para cualquier celebracion. Material duradero que mantiene el helio por 12+ horas.",
    price: 299.99,
    image: "https://images.unsplash.com/photo-1693651199295-2dee5af42919?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xvcmZ1bCUyMGJhbGxvb25zJTIwcGFydHl8ZW58MXx8fHwxNzcyNzMzODIxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1693651199295-2dee5af42919?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xvcmZ1bCUyMGJhbGxvb25zJTIwcGFydHl8ZW58MXx8fHwxNzcyNzMzODIxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "cumpleanos",
    rating: 4.2,
    reviewCount: 89,
    stock: 120,
    sellerId: "s1",
    sellerName: "FiestaMax",
    reviews: [
      { id: "r3", userId: "u3", userName: "Ana L.", rating: 4, comment: "Buenos globos, colores vibrantes.", date: "2026-01-28" },
    ],
    type: "producto",
    status: "Aprobado"
  },
  {
    id: "p3",
    name: "Centro de Mesa Floral para Boda Elegante",
    description: "Centro de mesa con arreglo floral artificial premium. Incluye base dorada, flores de seda en tonos pastel y follaje verde. Altura 35cm. Ideal para mesas de boda o eventos formales.",
    price: 789.99,
    originalPrice: 950.00,
    image: "https://images.unsplash.com/photo-1581720848209-9721f8fa30ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWRkaW5nJTIwZGVjb3JhdGlvbiUyMGZsb3dlcnMlMjBlbGVnYW50fGVufDF8fHx8MTc3Mjc2NTAxOHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1581720848209-9721f8fa30ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWRkaW5nJTIwZGVjb3JhdGlvbiUyMGZsb3dlcnMlMjBlbGVnYW50fGVufDF8fHx8MTc3Mjc2NTAxOHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "bodas",
    rating: 4.8,
    reviewCount: 56,
    stock: 18,
    sellerId: "s2",
    sellerName: "EventosPro",
    reviews: [
      { id: "r4", userId: "u4", userName: "Sofia M.", rating: 5, comment: "Hermoso, se ve como flores reales. Perfecto para mi boda.", date: "2026-02-20" },
    ],
  },
  {
    id: "p4",
    name: "Pinata Estrella de 7 Picos Arcoiris",
    description: "Pinata artesanal tradicional mexicana en forma de estrella de 7 picos con acabado arcoiris. Resistente, capacidad para 3kg de dulces. Hecha a mano con papel de china y carton.",
    price: 349.99,
    image: "https://images.unsplash.com/photo-1596399761617-1a007364e98b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaSVDMyVCMWF0YSUyMG1leGljYW4lMjBwYXJ0eSUyMGNvbG9yZnVsfGVufDF8fHx8MTc3Mjc2NTAxOHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1596399761617-1a007364e98b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaSVDMyVCMWF0YSUyMG1leGljYW4lMjBwYXJ0eSUyMGNvbG9yZnVsfGVufDF8fHx8MTc3Mjc2NTAxOHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "fiestas-infantiles",
    rating: 4.6,
    reviewCount: 203,
    stock: 32,
    sellerId: "s3",
    sellerName: "PinatasMX",
    reviews: [
      { id: "r5", userId: "u5", userName: "Pedro H.", rating: 5, comment: "Muy resistente y colorida. Los ninos la amaron.", date: "2026-02-18" },
    ],
  },
  {
    id: "p5",
    name: "Luces LED Decorativas de Hadas (10m)",
    description: "Tira de luces LED tipo hada de 10 metros con 100 LEDs. Luz calida, resistente al agua, ideal para decorar fiestas, bodas, jardines. Con 8 modos de iluminacion y control remoto.",
    price: 189.99,
    image: "https://images.unsplash.com/photo-1767457393612-ccaa7528c482?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHJpbmclMjBsaWdodHMlMjBwYXJ0eSUyMG91dGRvb3IlMjBkZWNvcmF0aW9ufGVufDF8fHx8MTc3Mjc2NTAxOXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1767457393612-ccaa7528c482?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHJpbmclMjBsaWdodHMlMjBwYXJ0eSUyMG91dGRvb3IlMjBkZWNvcmF0aW9ufGVufDF8fHx8MTc3Mjc2NTAxOXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "bodas",
    rating: 4.4,
    reviewCount: 167,
    stock: 85,
    sellerId: "s2",
    sellerName: "EventosPro",
    reviews: [],
  },
  {
    id: "p6",
    name: "Set de Vajilla Desechable Premium (24 personas)",
    description: "Set completo de vajilla desechable para 24 personas. Incluye platos grandes, platos de postre, vasos, servilletas y cubiertos. Diseno elegante en dorado y blanco.",
    price: 549.99,
    image: "https://images.unsplash.com/photo-1545447859-2cab9acb4603?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXBlciUyMHBsYXRlcyUyMGN1cHMlMjBwYXJ0eSUyMHN1cHBsaWVzfGVufDF8fHx8MTc3Mjc2NTAxOXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1545447859-2cab9acb4603?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXBlciUyMHBsYXRlcyUyMGN1cHMlMjBwYXJ0eSUyMHN1cHBsaWVzfGVufDF8fHx8MTc3Mjc2NTAxOXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "cumpleanos",
    rating: 4.3,
    reviewCount: 94,
    stock: 60,
    sellerId: "s1",
    sellerName: "FiestaMax",
    reviews: [],
  },
  {
    id: "p7",
    name: "Mesa de Dulces - Kit Candy Bar Completo",
    description: "Kit completo para armar tu mesa de dulces. Incluye 6 contenedores de cristal, base de madera, etiquetas personalizables, pinzas y bolsas para 50 invitados.",
    price: 899.99,
    originalPrice: 1199.99,
    image: "https://images.unsplash.com/photo-1709549774212-17c34ebaedc1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW5keSUyMGJ1ZmZldCUyMHBhcnR5JTIwc3dlZXRzJTIwdGFibGV8ZW58MXx8fHwxNzcyNzY1MDE5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1709549774212-17c34ebaedc1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW5keSUyMGJ1ZmZldCUyMHBhcnR5JTIwc3dlZXRzJTIwdGFibGV8ZW58MXx8fHwxNzcyNzY1MDE5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "xv-anos",
    rating: 4.9,
    reviewCount: 42,
    stock: 12,
    sellerId: "s2",
    sellerName: "EventosPro",
    reviews: [],
  },
  {
    id: "p8",
    name: "Kit Decoracion Halloween Terrorifica",
    description: "Kit completo de decoracion de Halloween. Incluye telaranas, aranitas, calabazas LED, calaveras, banner de 'Happy Halloween' y 20 globos tematicos negros y naranjas.",
    price: 399.99,
    image: "https://images.unsplash.com/photo-1705413385538-06546cd1ae28?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYWxsb3dlZW4lMjBjb3N0dW1lJTIwcGFydHklMjBhY2Nlc3Nvcmllc3xlbnwxfHx8fDE3NzI3NjUwMjB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1705413385538-06546cd1ae28?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYWxsb3dlZW4lMjBjb3N0dW1lJTIwcGFydHklMjBhY2Nlc3Nvcmllc3xlbnwxfHx8fDE3NzI3NjUwMjB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "halloween",
    rating: 4.1,
    reviewCount: 76,
    stock: 28,
    sellerId: "s3",
    sellerName: "PinatasMX",
    reviews: [],
  },
  {
    id: "p9",
    name: "Adornos Navidenos Set Premium (36 piezas)",
    description: "Set de 36 adornos navidenos de alta calidad. Incluye esferas de cristal, copos de nieve, estrellas y figuras tematicas en tonos rojos, dorados y plateados.",
    price: 649.99,
    image: "https://images.unsplash.com/photo-1543589077-14340bb2cacb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHJpc3RtYXMlMjBkZWNvcmF0aW9ucyUyMG9ybmFtZW50cyUyMGZlc3RpdmV8ZW58MXx8fHwxNzcyNzY1MDIwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1543589077-14340bb2cacb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHJpc3RtYXMlMjBkZWNvcmF0aW9ucyUyMG9ybmFtZW50cyUyMGZlc3RpdmV8ZW58MXx8fHwxNzcyNzY1MDIwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "navidad",
    rating: 4.7,
    reviewCount: 134,
    stock: 40,
    sellerId: "s1",
    sellerName: "FiestaMax",
    reviews: [],
  },
  {
    id: "p10",
    name: "Kit Decoracion Baby Shower Pastel",
    description: "Kit completo para baby shower en tonos pastel. Incluye globos, guirnaldas, banner 'Baby Shower', centros de mesa, y accesorios para foto. Para nino o nina.",
    price: 529.99,
    image: "https://images.unsplash.com/photo-1765317270400-21fdaa0ce8ea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWJ5JTIwc2hvd2VyJTIwZGVjb3JhdGlvbiUyMHBhc3RlbHxlbnwxfHx8fDE3NzI3NjUwMjF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1765317270400-21fdaa0ce8ea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWJ5JTIwc2hvd2VyJTIwZGVjb3JhdGlvbiUyMHBhc3RlbHxlbnwxfHx8fDE3NzI3NjUwMjF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "baby-shower",
    rating: 4.6,
    reviewCount: 67,
    stock: 25,
    sellerId: "s2",
    sellerName: "EventosPro",
    reviews: [],
  },
  {
    id: "p11",
    name: "Set de Graduacion Dorado y Negro",
    description: "Kit de decoracion para fiesta de graduacion. Incluye globos dorados y negros, banner 'Felicidades Graduado', confeti, centros de mesa con birrete y pompones.",
    price: 419.99,
    image: "https://images.unsplash.com/photo-1746122072064-3273a25094c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmFkdWF0aW9uJTIwY2VsZWJyYXRpb24lMjBjYXBzfGVufDF8fHx8MTc3Mjc2NTAyMXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1746122072064-3273a25094c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmFkdWF0aW9uJTIwY2VsZWJyYXRpb24lMjBjYXBzfGVufDF8fHx8MTc3Mjc2NTAyMXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "graduacion",
    rating: 4.4,
    reviewCount: 51,
    stock: 35,
    sellerId: "s3",
    sellerName: "PinatasMX",
    reviews: [],
  },
  {
    id: "p12",
    name: "Caja de Regalos Sorpresa Explosiva",
    description: "Caja sorpresa explosiva para regalos. Al abrir se despliega con fotos, mensajes y confeti. Incluye materiales para personalizar, stickers y cinta decorativa.",
    price: 259.99,
    image: "https://images.unsplash.com/photo-1637590957181-8893af2a8344?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnaWZ0JTIwYm94ZXMlMjB3cmFwcGVkJTIwcHJlc2VudHN8ZW58MXx8fHwxNzcyNzY1MDE4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1637590957181-8893af2a8344?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnaWZ0JTIwYm94ZXMlMjB3cmFwcGVkJTIwcHJlc2VudHN8ZW58MXx8fHwxNzcyNzY1MDE4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "cumpleanos",
    rating: 4.3,
    reviewCount: 88,
    stock: 55,
    sellerId: "s1",
    sellerName: "FiestaMax",
    reviews: [],
    type: "producto",
    status: "Aprobado"
  },
  {
    id: "s_serv_1",
    name: "Servicio de Organizador de Eventos Planner",
    description: "Organización completa para tu evento (bodas, XV años, corporativo). Nos encargamos de todo, desde el banquete hasta la música. Reserva una cita inicial de consultoría.",
    price: 1500.00,
    image: "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXJ0eSUyMHBsYW5uZXJ8ZW58MXx8fDE3NzI3NjUwMjB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXJ0eSUyMHBsYW5uZXJ8ZW58MXx8fDE3NzI3NjUwMjB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    ],
    category: "bodas",
    rating: 5.0,
    reviewCount: 23,
    stock: 99, // Los servicios no tienen stock de piezas, la disponibilidad es por agenda
    sellerId: "s2",
    sellerName: "EventosPro",
    reviews: [],
    type: "servicio",
    durationMin: 120,
    status: "Aprobado"
  },
  {
    id: "s_serv_2",
    name: "Show de Magia Infantil y Animación",
    description: "Show de 1 hora de magia y animación con juegos para niños de 3 a 10 años. Incluye asistente, equipo de sonido y sorpresas. Selecciona la hora para tu fiesta.",
    price: 2500.00,
    originalPrice: 3000.00,
    image: "https://images.unsplash.com/photo-1530089711124-9ca31fb9e863?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWdpYyUyMHNob3d8ZW58MXx8fDE3NzM3ODI2OTB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    images: [
      "https://images.unsplash.com/photo-1530089711124-9ca31fb9e863?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWdpYyUyMHNob3d8ZW58MXx8fDE3NzM3ODI2OTB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    category: "fiestas-infantiles",
    rating: 4.8,
    reviewCount: 45,
    stock: 99,
    sellerId: "s4",
    sellerName: "MagicoMundo",
    reviews: [],
    type: "servicio",
    durationMin: 60,
    status: "En revision"
  },
  // Servicios adicionales
  {
    id: "s1",
    name: "Fotografia Profesional de Eventos",
    description: "Servicio completo de fotografia para eventos sociales. Incluye sesión de 4 horas, edición profesional de 200 fotos, entrega en USB y álbum digital. Cobertura completa de tu evento especial.",
    price: 3500.00,
    originalPrice: 4200.00,
    image: "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwcGhvdG9ncmFwaGVyfGVufDF8fHx8MTc3Mzc4MjY5MHww&ixlib=rb-4.1.0&q=80&w=1080",
    images: [
      "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwcGhvdG9ncmFwaGVyfGVufDF8fHx8MTc3Mzc4MjY5MHww&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    category: "fotografia-evento",
    rating: 4.9,
    reviewCount: 67,
    stock: 99,
    sellerId: "s1",
    sellerName: "FiestaMax",
    reviews: [],
    type: "servicio",
    durationMin: 240,
    status: "Aprobado"
  },
  {
    id: "s2",
    name: "DJ Profesional para Fiestas",
    description: "Servicio de DJ con equipo profesional de sonido. Incluye 4 horas de música, iluminación LED, micrófono inalámbrico y lista de reproducción personalizada según tus preferencias.",
    price: 2800.00,
    originalPrice: 3200.00,
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaiUyMHNldHVwfGVufDF8fHx8MTc3Mzc4MjY5MHww&ixlib=rb-4.1.0&q=80&w=1080",
    images: [
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaiUyMHNldHVwfGVufDF8fHx8MTc3Mzc4MjY5MHww&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    category: "musica-dj",
    rating: 4.7,
    reviewCount: 89,
    stock: 99,
    sellerId: "s1",
    sellerName: "FiestaMax",
    reviews: [],
    type: "servicio",
    durationMin: 240,
    status: "Aprobado"
  },
  {
    id: "s3",
    name: "Catering para Eventos",
    description: "Servicio de catering completo para eventos. Incluye buffet frío y caliente para 50 personas, bebidas, mesa dulce, manteleria y servicio de meseros. Menú personalizado disponible.",
    price: 4500.00,
    originalPrice: 5200.00,
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXRlcmluZyUyMHNlcnZpY2V8ZW58MXx8fHwxNzcwNzY1MzYxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    images: [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXRlcmluZyUyMHNlcnZpY2V8ZW58MXx8fHwxNzcwNzY1MzYxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    category: "catering-servicio",
    rating: 4.8,
    reviewCount: 123,
    stock: 99,
    sellerId: "s1",
    sellerName: "FiestaMax",
    reviews: [],
    type: "servicio",
    durationMin: 300,
    status: "Aprobado"
  }
];

export const mockOrders: Order[] = [
  {
    id: "o1",
    folio: "ORD-2026-001",
    date: "2026-03-01",
    items: [{ product: products[0], quantity: 2 }, { product: products[1], quantity: 1 }],
    total: 1219.97,
    status: "Entregado",
    buyerName: "Maria Garcia",
    buyerId: "u1",
    address: "Av. Reforma 123, Col. Centro, CDMX",
  },
  {
    id: "o2",
    folio: "ORD-2026-002",
    date: "2026-03-03",
    items: [{ product: products[2], quantity: 4 }],
    total: 3159.96,
    status: "Enviado",
    buyerName: "Carlos Rodriguez",
    buyerId: "u2",
    address: "Calle 5 de Mayo 456, Guadalajara, JAL",
  },
  {
    id: "o3",
    folio: "ORD-2026-003",
    date: "2026-03-05",
    items: [{ product: products[3], quantity: 1 }, { product: products[4], quantity: 2 }],
    total: 729.97,
    status: "En preparacion",
    buyerName: "Ana Lopez",
    buyerId: "u3",
    address: "Blvd. Adolfo Lopez Mateos 789, Monterrey, NL",
  },
];

export const mockUsers: User[] = [
  { id: "u1", name: "Maria Garcia", email: "maria@correo.com", role: "comprador", registrationDate: "2025-11-15", status: "Activo", phone: "55 1234 5678" },
  { id: "u2", name: "Carlos Rodriguez", email: "carlos@correo.com", role: "comprador", registrationDate: "2025-12-01", status: "Activo", phone: "33 9876 5432" },
  { id: "u3", name: "Ana Lopez", email: "ana@correo.com", role: "comprador", registrationDate: "2026-01-10", status: "Activo" },
  { id: "s1", name: "FiestaMax Store", email: "fiestamax@correo.com", role: "vendedor", registrationDate: "2025-10-01", status: "Activo" },
  { id: "s2", name: "EventosPro Store", email: "eventospro@correo.com", role: "vendedor", registrationDate: "2025-09-15", status: "Activo" },
  { id: "s3", name: "PinatasMX Store", email: "pinatasmx@correo.com", role: "vendedor", registrationDate: "2025-11-20", status: "Bloqueado" },
  { id: "a1", name: "Admin Principal", email: "admin@marketplace.com", role: "admin", registrationDate: "2025-08-01", status: "Activo" },
];

export const mockReports: Report[] = [
  { id: "rep1", reporterId: "u1", reporterName: "Maria Garcia", reportedName: "PinatasMX Store", reason: "Producto defectuoso", category: "Producto", date: "2026-02-28", status: "Pendiente", description: "La pinata llego rota y el vendedor no quiere hacer devolucion." },
  { id: "rep2", reporterId: "u2", reporterName: "Carlos Rodriguez", reportedName: "Usuario Falso", reason: "Cuenta fraudulenta", category: "Usuario", date: "2026-03-01", status: "Advertencia formal", description: "Este usuario publica resenas falsas en multiples productos." },
  { id: "rep3", reporterId: "u3", reporterName: "Ana Lopez", reportedName: "FiestaMax Store", reason: "Publicidad enganosa", category: "Producto", date: "2026-03-04", status: "Pendiente", description: "Las imagenes del producto no corresponden con lo recibido." },
];

export const mockBundles: Bundle[] = [
  {
    id: "b1",
    name: "Pack Fiesta Completa Cumpleanos",
    products: [products[0], products[1], products[5]],
    bundlePrice: 999.99,
    originalTotal: 1309.97,
    sellerId: "s1",
  },
  {
    id: "b2",
    name: "Pack Boda Romantica",
    products: [products[2], products[4]],
    bundlePrice: 849.99,
    originalTotal: 979.98,
    sellerId: "s2",
  },
];

export const mockAddresses: Address[] = [
  { id: "a1", label: "Casa", street: "Av. Reforma 123", city: "Ciudad de Mexico", state: "CDMX", zip: "06600", country: "Mexico", isDefault: true },
  { id: "a2", label: "Oficina", street: "Calle Palmas 456, Piso 3", city: "Ciudad de Mexico", state: "CDMX", zip: "11000", country: "Mexico", isDefault: false },
];

export const mockPaymentMethods: PaymentMethod[] = [
  { id: "pm1", userId: "u1", provider: "Visa", lastFour: "4242", expiry: "12/28", isDefault: true }
];

export const mockDiscounts: Discount[] = [
  { id: "d1", code: "TULTI10", percentage: 10, validUntil: "2026-12-31" },
  { id: "d2", code: "FIESTA20", percentage: 20, validUntil: "2026-06-30" }
];

export const mockBusinesses: BusinessProfile[] = [
  { id: "biz1", sellerId: "s1", businessName: "Fiestas Maximas SA de CV", rfc: "FIMA890101QW1", address: "Calle Falsa 123", lat: 19.4326, lng: -99.1332 },
  { id: "biz2", sellerId: "s2", businessName: "Eventos Profesionales SC", rfc: "EVPR780202ER2", address: "Av Patriotismo 456", lat: 19.3957, lng: -99.1769 }
];
