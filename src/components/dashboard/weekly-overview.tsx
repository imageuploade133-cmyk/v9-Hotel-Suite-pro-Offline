'use client';

import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const chartConfig = {
    occupancy: { label: 'Occupancy', color: 'hsl(var(--chart-1))' },
    income: { label: 'Income', color: 'hsl(var(--primary))' },
};

export function WeeklyOverview({ data }: any) {
  const { weeklyOccupancyData, weeklyIncomeData, userCurrency } = data;

  const formatCurrency = (value: number) => {
    if (typeof value !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: userCurrency || 'USD',
      notation: 'compact',
      compactDisplay: 'short'
    }).format(value);
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Weekly Overview</CardTitle>
        <CardDescription>
          A summary of occupancy and income over the last 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="income">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          </TabsList>
          <TabsContent value="income" className="pt-4">
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart accessibilityLayer data={weeklyIncomeData || []}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} tickMargin={10} axisLine={false} />
                <YAxis tickFormatter={value => formatCurrency(value as number)} width={80} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" formatter={(value) => formatCurrency(value as number)} />} />
                <Bar dataKey="income" fill="var(--color-income)" radius={4} />
              </BarChart>
            </ChartContainer>
          </TabsContent>
          <TabsContent value="occupancy" className="pt-4">
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart accessibilityLayer data={weeklyOccupancyData || []}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} tickMargin={10} axisLine={false} />
                <YAxis tickFormatter={value => `${value}%`} domain={[0, 100]} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="occupancy" fill="var(--color-occupancy)" radius={4} />
              </BarChart>
            </ChartContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
