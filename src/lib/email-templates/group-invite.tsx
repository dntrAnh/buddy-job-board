import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { brand, button, container, h1, main, text } from './_brand'

interface Props { inviterName?: string; groupName?: string; signupUrl?: string }

const GroupInviteEmail = ({ inviterName, groupName, signupUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${inviterName ?? 'A friend'} invited you to ${groupName ?? 'their job crew'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>CREW BOARD</Text>
        <Heading style={h1}>You're invited to {groupName ?? 'a job crew'}</Heading>
        <Text style={text}>
          {inviterName ?? 'A friend'} wants you on their private job board. Share job posts, see who applied, and get an ATS match score for every role. Sign up with this email address to join.
        </Text>
        <Button style={button} href={signupUrl ?? 'https://example.com'}>Join the group</Button>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: GroupInviteEmail,
  subject: (d: Record<string, any>) => `${d['inviterName'] ?? 'A friend'} invited you to ${d['groupName'] ?? 'their job crew'}`,
  displayName: 'Group invite',
  previewData: { inviterName: 'Amelia', groupName: 'Job Crew', signupUrl: 'https://example.com/auth' },
} satisfies TemplateEntry
