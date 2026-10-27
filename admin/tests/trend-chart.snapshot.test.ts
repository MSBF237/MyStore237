import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TrendChart from '../components/TrendChart.vue'

describe('trend chart snapshot', () => {
  it('provides a textual data alternative for the chart', () => {
    const wrapper = mount(TrendChart, {
      props: { title: 'Orders by day', labels: ['Mon'], values: [12] },
      global: {
        stubs: {
          ClientOnly: { template: '<div><slot /></div>' },
          Bar: true,
        },
      },
    })
    expect(wrapper.html()).toMatchSnapshot()
  })
})
