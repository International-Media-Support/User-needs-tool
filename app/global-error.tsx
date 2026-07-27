'use client'

// React render errors in the App Router are not caught by the normal error
// boundary, so Sentry needs this file to see them. Deliberately minimal: the
// error message is reported to Sentry, but nothing about it is rendered to the
// user, since a render error can occur while pasted content is in state.
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <h2>Something went wrong.</h2>
        <p>Please re-launch the tool from your Moodle course. If the problem
           continues, contact your course administrator.</p>
      </body>
    </html>
  )
}
