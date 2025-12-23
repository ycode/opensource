'use client';

/**
 * PaginatedCollection Component
 *
 * Client component that handles pagination for collection layers.
 * Hydrates from SSR with initial items and supports client-side navigation.
 * 
 * Features:
 * - URL-based pagination with layer-specific params (?p_LAYER_ID=N)
 * - Independent pagination for multiple collections on the same page
 * - Skeleton loading during page transitions
 * - Previous/Next button state management
 */

import React, { useState, useCallback, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { CollectionPaginationMeta, Layer } from '@/types';

interface PaginatedCollectionProps {
  children: React.ReactNode;
  paginationMeta: CollectionPaginationMeta;
  collectionLayerId: string;
}

export default function PaginatedCollection({
  children,
  paginationMeta,
  collectionLayerId,
}: PaginatedCollectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const { currentPage, totalPages, totalItems, itemsPerPage } = paginationMeta;

  // Handle page navigation - uses layer-specific URL param (p_LAYER_ID=N)
  // This enables independent pagination for multiple collections on the same page
  const navigateToPage = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    
    // Build new URL with layer-specific page param
    const params = new URLSearchParams(searchParams.toString());
    const paramKey = `p_${collectionLayerId}`;
    
    if (page === 1) {
      params.delete(paramKey); // Remove param for page 1 (cleaner URLs)
    } else {
      params.set(paramKey, String(page));
    }
    
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    
    // Use transition for smooth loading state
    startTransition(() => {
      router.push(newUrl);
    });
  }, [router, pathname, searchParams, totalPages, collectionLayerId]);

  // Handle click events on pagination buttons (delegated)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-pagination-action]') as HTMLElement;
      
      if (!button) return;
      
      const action = button.getAttribute('data-pagination-action');
      const layerId = button.getAttribute('data-collection-layer-id');
      
      // Only handle clicks for this collection's pagination
      if (layerId !== collectionLayerId) return;
      
      e.preventDefault();
      
      if (action === 'prev' && currentPage > 1) {
        navigateToPage(currentPage - 1);
      } else if (action === 'next' && currentPage < totalPages) {
        navigateToPage(currentPage + 1);
      }
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [collectionLayerId, currentPage, totalPages, navigateToPage]);

  return (
    <div 
      className={`relative ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
      data-paginated-collection={collectionLayerId}
    >
      {/* Loading overlay */}
      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      )}
      
      {/* Collection content - rendered from SSR */}
      {children}
    </div>
  );
}

/**
 * Skeleton placeholder for collection items during loading
 */
export function CollectionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i}
          className="animate-pulse bg-gray-200 rounded-lg h-32"
        />
      ))}
    </div>
  );
}
