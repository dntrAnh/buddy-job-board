import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { brand, button, container, h1, main, text } from './_brand'

interface Props { posterName?: string; company?: string; role?: string; groupName?: string; boardUrl?: string }

const NewJobEmail = ({ posterName, company, role, groupName, boardUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${posterName ?? 'A friend'} shared ${role ?? 'a job'} at ${company ?? 'a company'}. Go apply!`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>CREW BOARD</Text>
        <Heading style={h1}>New job: {role ?? 'New role'} at {company ?? 'a company'}</Heading>
        <Text style={text}>
          {posterName ?? 'Someone'} just posted this in {groupName ?? 'your group'}. Check your match score and apply while it's fresh.
        </Text>
        <Button style={button} href={boardUrl ?? 'https://example.com'}>See the job & apply</Button>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewJobEmail,
  subject: (d: Record<string, any>) => `New job: ${d['role'] ?? 'a role'} at ${d['company'] ?? 'a company'} — go apply`,
  displayName: 'New job posted',
  previewData: { posterName: 'Jess', company: 'Stripe', role: 'Product Designer', groupName: 'Job Crew', boardUrl: 'https://example.com/board' },
} satisfies TemplateEntry
