import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <Card className="p-10 text-center text-muted-foreground">
        <Construction className="h-8 w-8 mx-auto mb-2 opacity-50" />
        {text}
      </Card>
    </div>
  );
}
