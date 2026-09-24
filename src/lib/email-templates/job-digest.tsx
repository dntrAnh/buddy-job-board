import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { brand, button, container, h1, item, main, text } from './_brand'

interface Props { jobs?: { company: string; role: string }[]; boardUrl?: string }

const JobDigestEmail = ({ jobs = [], boardUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${jobs.length} new job${jobs.length === 1 ? '' : 's'} from your crew`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>CREW BOARD</Text>
        <Heading style={h1}>{jobs.length} new job{jobs.length === 1 ? '' : 's'} to apply to</Heading>
        <Text style={text}>Here's what your crew shared recently:</Text>
        {jobs.map((j, i) => (
          <Text key={i} style={item}>• <strong>{j.role}</strong> at {j.company}</Text>
        ))}
        <Text style={text}>&nbsp;</Text>
        <Button style={button} href={boardUrl ?? 'https://example.com'}>Open my board</Button>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: JobDigestEmail,
  subject: (d: Record<string, any>) => {
    const n = Array.isArray(d['jobs']) ? d['jobs'].length : 0
    return `${n} new job${n === 1 ? '' : 's'} from your crew`
  },
  displayName: 'New jobs digest (easy mode)',
  previewData: { jobs: [{ company: 'Stripe', role: 'Designer' }, { company: 'Notion', role: 'PM' }], boardUrl: 'https://example.com/board' },
} satisfies TemplateEntry
