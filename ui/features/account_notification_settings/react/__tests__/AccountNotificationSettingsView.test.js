/*
 * Copyright (C) 2021 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */
import {createCache} from '@canvas/apollo'
import {render, screen} from '@testing-library/react'
import {MockedProvider} from '@apollo/react-testing'
import mockGraphqlQuery from '@canvas/graphql-query-mock'
import React from 'react'
import {COURSE_NOTIFICATIONS_QUERY} from '../../../course_notification_settings/graphql/Queries'
import {ACCOUNT_NOTIFICATIONS_QUERY} from '../../graphql/Queries'
import AccountNotificationSettingsView from '../AccountNotificationSettingsView'
import {NOTIFICATION_PREFERENCES_CONTEXT_SELECT_QUERY} from '@canvas/notification-preferences/graphql/Queries'
import userEvent from '@testing-library/user-event'

async function mockUserEnrollmentsQuery(queryOverrides) {
  if (!Array.isArray(queryOverrides)) {
    queryOverrides = [queryOverrides]
  }
  const queryResult = await mockGraphqlQuery(
    NOTIFICATION_PREFERENCES_CONTEXT_SELECT_QUERY,
    queryOverrides,
    {
      userId: 1
    }
  )

  return [
    {
      request: {
        query: NOTIFICATION_PREFERENCES_CONTEXT_SELECT_QUERY,
        variables: {
          userId: '1'
        }
      },
      result: queryResult
    }
  ]
}

async function mockAccountNotificationsQuery(queryOverrides) {
  if (!Array.isArray(queryOverrides)) {
    queryOverrides = [queryOverrides]
  }
  const queryResult = await mockGraphqlQuery(ACCOUNT_NOTIFICATIONS_QUERY, queryOverrides, {
    accountId: 1,
    userId: 1
  })

  return [
    {
      request: {
        query: ACCOUNT_NOTIFICATIONS_QUERY,
        variables: {
          accountId: '1',
          userId: '1'
        }
      },
      result: queryResult
    }
  ]
}

async function mockCourseNotificationsQuery(queryOverrides) {
  if (!Array.isArray(queryOverrides)) {
    queryOverrides = [queryOverrides]
  }
  const queryResult = await mockGraphqlQuery(COURSE_NOTIFICATIONS_QUERY, queryOverrides, {
    courseId: 1,
    userId: 1
  })

  return [
    {
      request: {
        query: COURSE_NOTIFICATIONS_QUERY,
        variables: {
          courseId: '1',
          userId: '1'
        }
      },
      result: queryResult
    }
  ]
}

describe('Notification Settings page', () => {
  it('displays account settings by default', async () => {
    const mocks = await mockAccountNotificationsQuery({Node: {__typename: 'User'}})

    const {findByLabelText, findByText} = render(
      <MockedProvider mocks={mocks} cache={createCache()}>
        <AccountNotificationSettingsView accountId="1" userId="1" courseSelectorEnabled />
      </MockedProvider>
    )

    expect(await findByLabelText('Settings for')).toHaveValue('Account')
    expect(
      await findByText('Account-level notifications apply to all courses', {exact: false})
    ).toBeInTheDocument()
  })

  it('does not include inactive enrollments in the dropdown', async () => {
    const mocks = (await mockAccountNotificationsQuery({Node: {__typename: 'User'}})).concat(
      await mockUserEnrollmentsQuery({Node: {__typename: 'User'}})
    )

    const {findByLabelText} = render(
      <MockedProvider mocks={mocks} cache={createCache()}>
        <AccountNotificationSettingsView accountId="1" userId="1" courseSelectorEnabled />
      </MockedProvider>
    )

    const dropdown = await findByLabelText('Settings for')
    userEvent.click(dropdown)

    expect(await screen.queryByText('Hello World')).not.toBeInTheDocument()
  })

  it('only shows a course with multiple enrollments once', async () => {
    const accountMocks = await mockAccountNotificationsQuery({Node: {__typename: 'User'}})
    const enrollmentMocks = await mockUserEnrollmentsQuery({Node: {__typename: 'User'}})
    enrollmentMocks[0].result.data.legacyNode.enrollments.forEach(e => {
      e.course.name = 'Duplicate enrollment course'
      e.state = 'active'
      e.course.id = '1'
      e.course._id = '1'
    })

    const {findByLabelText} = render(
      <MockedProvider mocks={accountMocks.concat(enrollmentMocks)} cache={createCache()}>
        <AccountNotificationSettingsView accountId="1" userId="1" courseSelectorEnabled />
      </MockedProvider>
    )

    const dropdown = await findByLabelText('Settings for')
    userEvent.click(dropdown)

    expect((await screen.findAllByText('Duplicate enrollment course')).length).toEqual(1)
  })

  it('displays course settings when a course is selected', async () => {
    const accountMocks = await mockAccountNotificationsQuery({Node: {__typename: 'User'}})
    const courseMocks = await mockCourseNotificationsQuery({Node: {__typename: 'User'}})

    const enrollmentMocks = await mockUserEnrollmentsQuery({Node: {__typename: 'User'}})
    enrollmentMocks[0].result.data.legacyNode.enrollments[0].state = 'active'
    enrollmentMocks[0].result.data.legacyNode.enrollments[0].course.name = 'My favorite course 💕'
    enrollmentMocks[0].result.data.legacyNode.enrollments[0].course._id = '1'

    const {findByLabelText} = render(
      <MockedProvider
        mocks={accountMocks.concat(courseMocks, enrollmentMocks)}
        cache={createCache()}
      >
        <AccountNotificationSettingsView accountId="1" userId="1" courseSelectorEnabled />
      </MockedProvider>
    )

    // Switch to a course
    const dropdown = await findByLabelText('Settings for')
    userEvent.click(dropdown)

    const courseOption = await screen.findByText('My favorite course 💕')
    userEvent.click(courseOption)

    expect(
      await screen.findByText(
        'Course-level notifications are inherited from your account-level notification settings',
        {exact: false}
      )
    ).toBeInTheDocument()
  })

  it('does not display the dropdown when the feature is not enabled', async () => {
    const accountMocks = await mockAccountNotificationsQuery({Node: {__typename: 'User'}})
    const courseMocks = await mockCourseNotificationsQuery({Node: {__typename: 'User'}})
    const enrollmentMocks = await mockUserEnrollmentsQuery({Node: {__typename: 'User'}})

    const {queryByLabelText} = render(
      <MockedProvider
        mocks={accountMocks.concat(courseMocks, enrollmentMocks)}
        cache={createCache()}
      >
        <AccountNotificationSettingsView accountId="1" userId="1" />
      </MockedProvider>
    )

    expect(await queryByLabelText('Settings for')).not.toBeInTheDocument()
  })
})
