import os
import glob

# Files to update
files = glob.glob('E:/Pos - System/frontend/app/pos/**/page.tsx', recursive=True)

menu_inactive = `<button onClick={() => router.push('/pos/menu')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">เมนูและโปรโมชั่น</button>`
menu_active = `<button className="py-5 px-6 text-left font-medium border-b border-[#666666] transition-colors bg-[#666666] border-l-4 border-l-white">เมนูและโปรโมชั่น</button>`

emp_inactive = `<button onClick={() => router.push('/pos/employees')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">พนักงาน</button>`
emp_active = `<button onClick={() => router.push('/pos/employees')} className="py-5 px-6 text-left font-medium border-b border-[#666666] transition-colors bg-[#666666] border-l-4 border-l-white">พนักงาน</button>`

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Check and replace Menu
    if menu_inactive in content:
        content = content.replace(menu_inactive, `{user?.role !== 'พนักงาน' && (\n          ` + menu_inactive + `\n          )}`)
    elif menu_active in content:
        content = content.replace(menu_active, `{user?.role !== 'พนักงาน' && (\n          ` + menu_active + `\n          )}`)
        
    # Check and replace Employee
    if emp_inactive in content:
        content = content.replace(emp_inactive, `{user?.role !== 'พนักงาน' && (\n          ` + emp_inactive + `\n          )}`)
    elif emp_active in content:
        content = content.replace(emp_active, `{user?.role !== 'พนักงาน' && (\n          ` + emp_active + `\n          )}`)

    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes for {filepath}")
