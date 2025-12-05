import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Percent } from "lucide-react";

interface ReportStatsProps {
  revenue: number;
  cost: number;
}

export function ReportStats({ revenue, cost }: ReportStatsProps) {
  const grossProfit = revenue - cost;
  const marginPercentage = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            LKR {revenue.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">Total sales value</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Cost of Goods (COGS)
          </CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">LKR {cost.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Base cost of products sold
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              grossProfit >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            LKR {grossProfit.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">Revenue - Cost</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {marginPercentage.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            Average return on sales
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
