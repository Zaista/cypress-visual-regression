import { faker } from '@faker-js/faker'
import { ComparisonResult } from '../../dist/src/command.js'

describe('Visual Regression Example', () => {
  it('should display the home page correctly', () => {
    cy.visit('./cypress/web/01.html')
    cy.get('H1').contains('Hello, World').should('exist')
    cy.compareSnapshot('home')
  })

  it('handle missing base snapshot file as a failed spec', () => {
    const randomWord = faker.word.sample()
    cy.on('fail', (error) => {
      expect(error.message).to.match(new RegExp(`File '.*${randomWord}.png' does not exist.`))
      return
    })
    cy.visit('./cypress/web/01.html')
    cy.compareSnapshot(randomWord)
  })

  it('should display the register page correctly', () => {
    cy.visit('./cypress/web/02.html')
    cy.get('H1').contains('Register').should('exist')
    cy.compareSnapshot('register')
  })

  it('should display the login page correctly', () => {
    cy.visit('./cypress/web/03.html')
    cy.get('H1').contains('Login').should('exist')
    cy.compareSnapshot('login', 0.0)
    cy.compareSnapshot('login', 0.1)
  })

  it('should display the component correctly', () => {
    cy.visit('./cypress/web/03.html')
    cy.get('H1').contains('Login').should('exist')
    cy.get('form')
      .compareSnapshot('login-form')
      // @ts-ignore TODO
      .should((comparisonResult) => {
        if (Cypress.env('visualRegression').type === 'base') {
          expect(comparisonResult).to.be.true
        } else {
          expect(comparisonResult.mismatchedPixels).to.equal(0)
          expect(comparisonResult.percentage).to.equal(0)
          expect(comparisonResult.error).to.not.exist
        }
      })
    cy.get('form')
      .compareSnapshot('login-form', 0.02)
      // @ts-ignore TODO
      .should((comparisonResult: any) => {
        if (Cypress.env('visualRegression').type === 'base') {
          expect(comparisonResult).to.be.true
        } else {
          expect(comparisonResult.mismatchedPixels).to.equal(0)
          expect(comparisonResult.percentage).to.equal(0)
          expect(comparisonResult.error).to.not.exist
        }
      })
  })

  it('should display the foo page incorrectly', () => {
    cy.on('fail', (error) => {
      if (error.message.includes('The "bar" image is different. Threshold limit exceeded!')) {
        return
      }
      throw error
    })
    if (Cypress.env('visualRegression').type === 'base') {
      cy.visit('./cypress/web/04.html')
      cy.get('H1').contains('bar').should('exist')
    } else {
      cy.visit('./cypress/web/05.html')
      cy.get('H1').contains('none').should('exist')
    }
    cy.compareSnapshot('bar')
  })

  it('should handle custom error thresholds correctly', () => {
    if (Cypress.env('visualRegression').type === 'base') {
      cy.visit('./cypress/web/04.html')
      cy.compareSnapshot('foo')
      cy.get('H1').compareSnapshot('h1')
    } else {
      cy.visit('./cypress/web/05.html')
      cy.get('H1').contains('none').should('exist')
      // @ts-ignore TODO
      cy.compareSnapshot('foo', 0.02).should((comparisonResult: any) => {
        expect(comparisonResult.error).to.be.undefined
        expect(comparisonResult.percentage).to.be.below(0.02)
      })
      cy.compareSnapshot('foo', { errorThreshold: 0.01, failSilently: true }).should(
        // @ts-ignore TODO
        (comparisonResult: any) => {
          expect(comparisonResult.percentage).to.be.above(0.01)
          expect(comparisonResult.error).to.exist
        }
      )
      cy.get('H1')
        .compareSnapshot('h1', 0.073)
        // @ts-ignore TODO
        .should((comparisonResult: any) => {
          expect(comparisonResult.error).to.be.undefined
          expect(comparisonResult.percentage).to.be.below(0.073)
        })
      cy.get('H1')
        .compareSnapshot('h1', { errorThreshold: 0.01, failSilently: true })
        // @ts-ignore TODO
        .should((comparisonResult: any) => {
          expect(comparisonResult.percentage).to.be.above(0.01)
          expect(comparisonResult.error).to.exist
        })
    }
  })

  it('should handle custom error thresholds correctly - take 2', () => {
    if (Cypress.env('visualRegression').type === 'base') {
      cy.visit('./cypress/web/06.html')
    } else {
      cy.visit('./cypress/web/07.html')
    }
    cy.get('H1').contains('Color').should('exist')
    cy.compareSnapshot('baz', 0.029)
    cy.compareSnapshot('baz', { errorThreshold: 0.02, failSilently: true })
    cy.compareSnapshot('baz', { failSilently: true })
  })

  it('should compare images of different sizes', () => {
    cy.on('fail', (error) => {
      if (error.message.includes('The "bar-07" image is different. Threshold limit exceeded!')) {
        return
      }
      throw error
    })
    if (Cypress.env('visualRegression').type === 'base') {
      cy.visit('./cypress/web/07.html')
    } else {
      cy.visit('./cypress/web/08.html')
    }
    cy.get('H1').contains('Color').should('exist')
    cy.compareSnapshot('bar-07')
  })

  it('should pass parameters to cy.screenshot', () => {
    cy.visit('./cypress/web/08.html')
    cy.compareSnapshot('screenshot-params-full', {
      capture: 'fullPage'
      // @ts-ignore TODO
    }).then((result: any) => {
      expect(result.error).is.undefined
    })
  })

  const visualRegressionConfig = Cypress.env('visualRegression')
  visualRegressionConfig.failSilently = true

  it(
    'should not fail if failSilently is set in env',
    {
      env: visualRegressionConfig
    },
    () => {
      if (Cypress.env('visualRegression').type === 'base') {
        cy.visit('./cypress/web/04.html')
        cy.get('H1').contains('bar').should('exist')
        cy.compareSnapshot('foo')
        cy.get('H1').compareSnapshot('h1')
      } else {
        cy.visit('./cypress/web/05.html')
        cy.get('H1').contains('none').should('exist')
        // @ts-ignore TODO
        cy.compareSnapshot('foo', 0.01).should((comparisonResults: any) => {
          expect(comparisonResults.error).to.exist
        })
        cy.get('H1')
          .compareSnapshot('h1', 0.02)
          // @ts-ignore TODO
          .should((comparisonResults: any) => {
            expect(comparisonResults.error).to.exist
          })
      }
    }
  )
})
