import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { brand, button, container, h1, item, main, text } from './_brand'

interface Props { jobs?: { company: string; role: string; appliedCount: number }[]; boardUrl?: string }

const WeeklyReminderEmail = ({ jobs = [], boardUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`You still have ${jobs.length} job${jobs.length === 1 ? '' : 's'} to apply to`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>CREW BOARD</Text>
        <Heading style={h1}>Your weekly to-apply list</Heading>
        <Text style={text}>These are still waiting on you:</Text>
        {jobs.map((j, i) => (
          <Text key={i} style={item}>• <strong>{j.role}</strong> at {j.company}{j.appliedCount > 0 ? ` — ${j.appliedCount} friend${j.appliedCount === 1 ? '' : 's'} applied` : ''}</Text>
        ))}
        <Text style={text}>&nbsp;</Text>
        <Button style={button} href={boardUrl ?? 'https://example.com'}>Open my board</Button>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WeeklyReminderEmail,
  subject: (d: Record<string, any>) => {
    const n = Array.isArray(d['jobs']) ? d['jobs'].length : 0
    return `Weekly reminder: ${n} job${n === 1 ? '' : 's'} to apply to`
  },
  displayName: 'Weekly reminder',
  previewData: { jobs: [{ company: 'Stripe', role: 'Designer', appliedCount: 2 }], boardUrl: 'https://example.com/board' },
} satisfies TemplateEntry
