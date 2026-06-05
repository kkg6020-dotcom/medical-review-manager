import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '의료심의 관리',
  description: '병원별 의료광고 심의 현황 관리 시스템',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
