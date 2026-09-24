import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { brand, button, container, h1, main, text } from './_brand'

interface Props { friendName?: string; company?: string; role?: string; boardUrl?: string }

const FriendAppliedEmail = ({ friendName, company, role, boardUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${friendName ?? 'A friend'} applied to ${company ?? 'a job'} — your turn!`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>CREW BOARD</Text>
        <Heading style={h1}>{friendName ?? 'A friend'} just applied. Your turn!</Heading>
        <Text style={text}>
          {friendName ?? 'Someone in your group'} applied to {role ?? 'a role'} at {company ?? 'a company'}. You haven't yet — don't let it slip.
        </Text>
        <Button style={button} href={boardUrl ?? 'https://example.com'}>Apply now</Button>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: FriendAppliedEmail,
  subject: (d: Record<string, any>) => `${d['friendName'] ?? 'A friend'} applied to ${d['company'] ?? 'a job'} — your turn`,
  displayName: 'Friend applied nudge',
  previewData: { friendName: 'Sam', company: 'Figma', role: 'Frontend Engineer', boardUrl: 'https://example.com/board' },
} satisfies TemplateEntry
