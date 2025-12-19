/**
 * Folder API functions for organizing study sessions
 */
import { Folder } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Get the authentication token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

/**
 * Create a new folder
 */
export async function createFolder(name: string, color: string = '#3B82F6', icon: string = '📁'): Promise<Folder> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ name, color, icon }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create folder');
  }

  return response.json();
}

/**
 * Update a folder
 */
export async function updateFolder(folderId: number, updates: Partial<Folder>): Promise<Folder> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/folders/${folderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update folder');
  }

  return response.json();
}

/**
 * Delete a folder (sessions move to root)
 */
export async function deleteFolder(folderId: number): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/folders/${folderId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete folder');
  }
}

/**
 * Move a session to a folder
 */
export async function moveSessionToFolder(sessionId: string, folderId: number): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/folders/${folderId}/sessions/${sessionId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to move session to folder');
  }
}

/**
 * Remove a session from a folder (move to root)
 */
export async function removeSessionFromFolder(sessionId: string, folderId: number): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/folders/${folderId}/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to remove session from folder');
  }
}
