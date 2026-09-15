describe('Book Collection Manager', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('opens the library and exposes book controls', () => {
    cy.contains('h1', 'Stories worth keeping.')
    cy.get('ion-searchbar').should('exist')
    cy.contains('button', 'Available').should('exist')
    cy.contains('ion-button', 'Add book').should('exist')
  })
})
