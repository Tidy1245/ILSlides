export async function openSetting(page,title) {
 const button=page.locator('.setting-section-header').getByRole('button',{name:title,exact:true})
 if(await button.getAttribute('aria-expanded')!=='true') await button.click()
}
