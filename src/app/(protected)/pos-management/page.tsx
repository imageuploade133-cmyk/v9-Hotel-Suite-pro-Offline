'use client';

import React, { useState } from 'react';
import { Building, Plus, Trash2, Edit2, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBranch, PointOfSale } from '@/contexts/branch-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, deleteDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';

interface CreatePosForm {
  name: string;
  type: 'hotel' | 'restaurant' | 'main' | 'other';
}

function POSManagementPage() {
  const { currentBranchId, currentBranch, pointOfSales } = useBranch();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [formData, setFormData] = useState<CreatePosForm>({ name: '', type: 'main' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  if (!currentBranchId || currentBranchId === 'global') {
    return (
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950">
          <CardContent className="pt-6">
            <p className="text-amber-900 dark:text-amber-100">Please select a specific branch to manage POS terminals.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreatePos = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Please enter a POS name', variant: 'destructive' });
      return;
    }

    if (!currentBranchId) return;

    setIsCreating(true);
    try {
      const posCollectionPath = `branches/${currentBranchId}/pointOfSales`;
      await addDoc(collection(firestore, posCollectionPath), {
        name: formData.name.trim(),
        type: formData.type,
        branchId: currentBranchId,
        status: 'active',
        createdAt: serverTimestamp(),
      });

      toast({ title: 'Success', description: `POS "${formData.name}" created successfully` });
      setFormData({ name: '', type: 'main' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create POS', variant: 'destructive' });
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePos = async (posId: string) => {
    try {
      const posDocPath = `branches/${currentBranchId}/pointOfSales/${posId}`;
      await deleteDoc(doc(firestore, posDocPath));
      toast({ title: 'Success', description: 'POS deleted successfully' });
      setDeleteConfirm(null);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete POS', variant: 'destructive' });
      console.error(error);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      hotel: 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100',
      restaurant: 'bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100',
      main: 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100',
      other: 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100',
    };
    return colors[type] || colors.other;
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">POS Management</h1>
        <p className="text-muted-foreground">
          Manage Point of Sale terminals for {currentBranch?.name || 'Selected Branch'}
        </p>
      </div>

      <Separator />

      {/* Create POS Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add New POS Terminal</CardTitle>
          <CardDescription>Create a new point of sale with isolated data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">POS Name</label>
              <Input
                placeholder="e.g., Counter 1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hotel">Hotel</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="main">Main</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreatePos} disabled={isCreating} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add POS
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* POS Terminals List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Active POS Terminals ({pointOfSales.length})</h2>
        {pointOfSales.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No POS terminals created yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pointOfSales.map((pos) => (
              <Card key={pos.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold">{pos.name}</h3>
                    </div>
                    <Badge className={getTypeColor(pos.type)}>{pos.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Activity className="h-4 w-4" />
                    <span>Status: <span className="text-green-600 font-medium">Active</span></span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteConfirm(pos.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete POS Terminal?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All associated data will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeletePos(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default withAuth(POSManagementPage, PagePermission.MANAGE_POS_SETTINGS);
