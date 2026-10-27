import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RoleSelector from '../components/RoleSelector.vue'

describe('login form snapshot', () => {
  it('renders the demo role choices and sign-in action accessibly', () => {
    expect(mount(RoleSelector, { props: { modelValue: 'admin' } }).html()).toMatchSnapshot()
  })
})
