export interface OpportunityListRow {
  id: string
  title: string | null
  source: string
  agency: string | null
  posted_date: Date | null
  response_deadline: Date | null
  estimated_value_max: number | null
  stage: string | null
  status: string | null
  product_count: number
  bid_count: number
}
