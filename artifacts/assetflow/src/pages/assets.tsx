import { useState, useMemo } from "react";
import { 
  useListAssets, 
  useCreateAsset, 
  useUpdateAsset, 
  useDeleteAsset,
  useListAssetCategories,
  useListDepartments,
  useListEmployees,
  getListAssetsQueryKey,
  Asset,
  AssetStatus,
  AssetCondition,
  AssetInputStatus,
  AssetInputCondition
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AssetStatusBadge, AssetConditionBadge, AssetTag } from "@/components/badges";
import { Plus, Edit2, Trash2, Search, Filter, LayoutList, LayoutGrid, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  serialNumber: z.string().optional().nullable(),
  categoryId: z.coerce.number().min(1, "Category is required"),
  departmentId: z.coerce.number().optional().nullable(),
  employeeId: z.coerce.number().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchaseCost: z.coerce.number().optional().nullable(),
  vendor: z.string().optional().nullable(),
  condition: z.enum([AssetInputCondition.excellent, AssetInputCondition.good, AssetInputCondition.fair, AssetInputCondition.poor]),
  status: z.enum([AssetInputStatus.available, AssetInputStatus.allocated, AssetInputStatus.reserved, AssetInputStatus.under_maintenance, AssetInputStatus.lost, AssetInputStatus.retired, AssetInputStatus.disposed]),
  bookable: z.boolean().default(false),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Assets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  
  const { data: assets, isLoading } = useListAssets();
  const { data: categories } = useListAssetCategories();
  const { data: departments } = useListDepartments();
  const { data: employees } = useListEmployees();

  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset();
  const deleteMutation = useDeleteAsset();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      serialNumber: "",
      categoryId: 0,
      departmentId: null,
      employeeId: null,
      purchaseDate: new Date().toISOString().split('T')[0],
      purchaseCost: 0,
      vendor: "",
      condition: AssetInputCondition.excellent,
      status: AssetInputStatus.available,
      bookable: true,
      location: "",
      description: "",
    },
  });

  const openCreateForm = () => {
    form.reset({ 
      name: "", serialNumber: "", categoryId: categories?.[0]?.id || 0, departmentId: null, employeeId: null, 
      purchaseDate: new Date().toISOString().split('T')[0], purchaseCost: null, vendor: "",
      condition: AssetInputCondition.excellent, status: AssetInputStatus.available, bookable: true,
      location: "", description: ""
    });
    setEditingId(null);
    setIsFormOpen(true);
  };

  const openEditForm = (asset: Asset) => {
    form.reset({
      name: asset.name,
      serialNumber: asset.serialNumber || "",
      categoryId: asset.categoryId || 0,
      departmentId: asset.departmentId,
      employeeId: asset.employeeId,
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : "",
      purchaseCost: asset.purchaseCost,
      vendor: asset.vendor || "",
      condition: asset.condition as AssetInputCondition,
      status: asset.status as AssetInputStatus,
      bookable: asset.bookable,
      location: asset.location || "",
      description: asset.description || "",
    });
    setEditingId(asset.id);
    setIsFormOpen(true);
  };

  const confirmDelete = (id: number) => {
    setDeletingId(id);
    setIsDeleteOpen(true);
  };

  const onSubmit = (values: FormValues) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() });
          setIsFormOpen(false);
          toast({ title: "Asset updated" });
        },
        onError: (err: any) => toast({ title: "Error", description: err.error || "Failed to update asset", variant: "destructive" })
      });
    } else {
      createMutation.mutate({ data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() });
          setIsFormOpen(false);
          toast({ title: "Asset created" });
        },
        onError: (err: any) => toast({ title: "Error", description: err.error || "Failed to create asset", variant: "destructive" })
      });
    }
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteMutation.mutate({ id: deletingId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() });
        setIsDeleteOpen(false);
        toast({ title: "Asset disposed" });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.error || "Failed to delete asset", variant: "destructive" });
        setIsDeleteOpen(false);
      }
    });
  };

  const filtered = useMemo(() => {
    return assets?.filter(a => {
      const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || 
                          a.tag.toLowerCase().includes(search.toLowerCase()) ||
                          (a.serialNumber && a.serialNumber.toLowerCase().includes(search.toLowerCase()));
      const matchCat = categoryFilter === "all" || a.categoryId === parseInt(categoryFilter);
      const matchStatus = statusFilter === "all" || a.status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    }) || [];
  }, [assets, search, categoryFilter, statusFilter]);

  // Kanban groupings
  const groupedByStatus = useMemo(() => {
    const cols: Record<string, Asset[]> = {
      [AssetStatus.available]: [],
      [AssetStatus.allocated]: [],
      [AssetStatus.under_maintenance]: [],
      [AssetStatus.retired]: [],
    };
    filtered.forEach(a => {
      if (cols[a.status]) {
        cols[a.status].push(a);
      } else if (a.status !== AssetStatus.disposed) {
        // Group reserved, lost etc into a generic catch-all if needed, but we'll focus on main ones
        if (!cols["other"]) cols["other"] = [];
        cols["other"].push(a);
      }
    });
    return cols;
  }, [filtered]);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asset Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage and track company hardware and resources.</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "kanban")}>
            <TabsList>
              <TabsTrigger value="table"><LayoutList className="h-4 w-4 mr-2" /> Table</TabsTrigger>
              <TabsTrigger value="kanban"><LayoutGrid className="h-4 w-4 mr-2" /> Board</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" /> Add Asset
          </Button>
        </div>
      </div>

      <Card className="flex-shrink-0">
        <CardHeader className="py-4 border-b flex flex-row items-center gap-4 space-y-0 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, tag, serial..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="All Categories" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <SelectValue placeholder="All Statuses" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(AssetStatus).map(([k, v]) => (
                <SelectItem key={k} value={v}>{v.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
      </Card>

      {viewMode === "table" ? (
        <Card className="flex-1 overflow-hidden flex flex-col">
          <CardContent className="p-0 overflow-auto flex-1">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Allocation</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading assets...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No assets found.</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 mb-1">
                          <AssetTag tag={asset.tag} />
                          <span className="font-semibold text-sm">{asset.name}</span>
                        </div>
                        {asset.serialNumber && <div className="text-xs text-muted-foreground font-mono">SN: {asset.serialNumber}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{asset.categoryName || "-"}</TableCell>
                      <TableCell>
                        {asset.employeeName ? (
                          <div className="text-sm font-medium">{asset.employeeName}</div>
                        ) : asset.departmentName ? (
                          <div className="text-sm">{asset.departmentName} Dept</div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Unallocated</span>
                        )}
                      </TableCell>
                      <TableCell><AssetConditionBadge condition={asset.condition} /></TableCell>
                      <TableCell><AssetStatusBadge status={asset.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditForm(asset)}>
                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => confirmDelete(asset.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {[
            { id: AssetStatus.available, name: "Available", color: "bg-emerald-500" },
            { id: AssetStatus.allocated, name: "Allocated", color: "bg-blue-500" },
            { id: AssetStatus.under_maintenance, name: "Maintenance", color: "bg-orange-500" },
            { id: AssetStatus.retired, name: "Retired", color: "bg-slate-500" },
          ].map(col => (
            <div key={col.id} className="flex-1 min-w-[280px] bg-muted/30 rounded-xl border flex flex-col h-full max-h-full overflow-hidden">
              <div className="p-3 border-b bg-muted/50 font-semibold flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${col.color}`} />
                  {col.name}
                </div>
                <span className="text-xs bg-background border px-2 py-0.5 rounded-full">{groupedByStatus[col.id]?.length || 0}</span>
              </div>
              <div className="p-3 overflow-y-auto flex-1 space-y-3">
                {groupedByStatus[col.id]?.map(asset => (
                  <Card key={asset.id} className="cursor-pointer hover:border-primary/50 transition-colors shadow-sm" onClick={() => openEditForm(asset)}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <AssetTag tag={asset.tag} />
                        <AssetConditionBadge condition={asset.condition} />
                      </div>
                      <div className="font-semibold text-sm line-clamp-2">{asset.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {asset.categoryName}
                      </div>
                      {(asset.employeeName || asset.departmentName) && (
                        <div className="text-xs font-medium pt-2 border-t mt-2">
                          {asset.employeeName ? `👤 ${asset.employeeName}` : `🏢 ${asset.departmentName}`}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Asset" : "Register New Asset"}</DialogTitle>
            <DialogDescription>Fill in the asset details below. The Asset Tag will be auto-generated.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="space-y-4">
                <h3 className="font-semibold text-sm border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Name</FormLabel>
                      <FormControl><Input placeholder="MacBook Pro M2" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="categoryId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="serialNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl><Input placeholder="SN-123456" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="vendor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor / Manufacturer</FormLabel>
                      <FormControl><Input placeholder="Apple Inc" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-sm border-b pb-2">State & Allocation</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.entries(AssetInputStatus).map(([k, v]) => (
                            <SelectItem key={k} value={v}>{v.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="condition" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Condition" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.entries(AssetInputCondition).map(([k, v]) => (
                            <SelectItem key={k} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="departmentId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allocate to Department</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} value={field.value?.toString() || "none"}>
                        <FormControl><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {departments?.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="employeeId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allocate to Employee</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} value={field.value?.toString() || "none"}>
                        <FormControl><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {employees?.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                
                <FormField control={form.control} name="bookable" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Bookable Asset</FormLabel>
                      <p className="text-sm text-muted-foreground">Allow employees to request/book this asset.</p>
                    </div>
                  </FormItem>
                )} />
              </div>
              
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Save Changes" : "Register Asset"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire / Dispose Asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the asset as disposed. It will no longer appear in active inventories but will remain in historical records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-slate-700 text-white hover:bg-slate-800">
              Mark Disposed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
