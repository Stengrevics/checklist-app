import './globals.css';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Checklist App',
    description: 'Car repair workflow tool',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="bg-slate-950 text-slate-100">
                {children}
            </body>
        </html>
    );
}
