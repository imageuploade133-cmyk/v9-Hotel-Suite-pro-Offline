// A custom error class for Firestore permission errors
export class FirestorePermissionError extends Error {
  path: string;
  operation: 'create' | 'read' | 'update' | 'delete' | 'list';
  requestResourceData?: any;

  constructor({
    message = 'You do not have permission to perform this action.',
    path,
    operation,
    requestResourceData,
  }: {
    message?: string;
    path: string;
    operation: 'create' | 'read' | 'update' | 'delete' | 'list';
    requestResourceData?: any;
  }) {
    super(message);
    this.name = 'FirestorePermissionError';
    this.path = path;
    this.operation = operation;
    this.requestResourceData = requestResourceData;
  }
}
