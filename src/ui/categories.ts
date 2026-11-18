import { Coffee, Cross, Grid2X2, ShoppingBasket, TrainFront, Trees } from 'lucide-react'
import type { CategoryFilter } from '../routing/types'

export const categories = {
  all: { label: 'All categories', color: '#4c6178', icon: Grid2X2 },
  groceries: { label: 'Groceries', color: '#bf590b', icon: ShoppingBasket },
  transit: { label: 'Transit', color: '#165dcc', icon: TrainFront },
  pharmacy: { label: 'Pharmacies', color: '#b2266d', icon: Cross },
  parks: { label: 'Parks', color: '#327448', icon: Trees },
  cafes: { label: 'Cafés', color: '#855229', icon: Coffee },
} satisfies Record<CategoryFilter, { label: string; color: string; icon: typeof Trees }>

export const homeColors = ['#5140bf', '#087580', '#9f3d63', '#7a520f', '#395b88']
export const letters = 'ABCDE'
export const sharedColor = '#526f99'
