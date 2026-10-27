'use client';

import React from 'react';
import { useUser } from '@/contexts/user-context';
import { useAuth } from '@/components/auth/auth-provider';
import { useBranch } from '@/contexts/branch-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Building, Clock, Contact } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

export default function BranchAssignmentPage() {
  const { userProfile, loading: isUserLoading } = useUser();
  const { user } = useAuth();
  const { branches } = useBranch();
  const router = useRouter();

  const isAssigned = userProfile?.assignedBranches && userProfile.assignedBranches.length > 0;
  const assignedBranches = branches?.filter(b => userProfile?.assignedBranches?.includes(b.id)) || [];

  React.useEffect(() => {
    // If user is assigned to branches, redirect to dashboard
    if (!isUserLoading && isAssigned) {
      router.replace('/dashboard');
    }
  }, [isAssigned, isUserLoading, router]);

  if (isUserLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <Skeleton className="h-96 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Branch Assignment Pending</h1>
          <p className="mt-2 text-muted-foreground">
            Your access depends on proper branch assignment
          </p>
        </div>

        {/* Unassigned Card */}
        {!isAssigned && (
          <Alert variant="destructive" className="border-2">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">Awaiting Branch Assignment</AlertTitle>
            <AlertDescription className="mt-2 text-sm leading-relaxed">
              An administrator needs to assign you to one or more branches before you can access the system.
              Please contact your manager or administrator to complete your setup.
            </AlertDescription>
          </Alert>
        )}

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Account Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Contact className="h-5 w-5 text-primary" />
                Account Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <Badge variant="outline">{userProfile?.role || 'Unassigned'}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Branch Assignment Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building className="h-5 w-5 text-primary" />
                Branch Assignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAssigned ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Assigned ({assignedBranches.length})</span>
                  </div>
                  <div className="space-y-1">
                    {assignedBranches.map(branch => (
                      <div key={branch.id} className="text-sm text-muted-foreground pl-7">
                        {branch.name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">Pending Assignment</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions Card */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">What Happens Next?</CardTitle>
            <CardDescription>Follow these steps to complete your setup</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>
                <div>
                  <p className="font-medium">Contact Your Administrator</p>
                  <p className="text-sm text-muted-foreground">Reach out to your manager to request branch access assignment</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">2</span>
                <div>
                  <p className="font-medium">They Will Assign Your Branches</p>
                  <p className="text-sm text-muted-foreground">Administrators can manage branch assignments in the Staff Management page</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">3</span>
                <div>
                  <p className="font-medium">Return and Refresh</p>
                  <p className="text-sm text-muted-foreground">Once assigned, refresh this page or log out and log back in</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            Refresh Status
          </Button>
          {isAssigned && (
            <Button
              className="w-full"
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
