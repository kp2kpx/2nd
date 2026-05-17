export interface DataPoint {
  date: number   // unix seconds
  supply: number // USD
}

export interface StablecoinData {
  id: string
  name: string
  symbol: string
  color: string
  currentSupply: number
  series: DataPoint[]
}
