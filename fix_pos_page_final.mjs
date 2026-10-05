import fs from 'fs';
import path from 'path';

const file = 'frontend/src/app/pos/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("import generatePayload from 'promptpay-qr';")) {
    content = content.replace("import { useState, useEffect, useRef } from \"react\";", "import { useState, useEffect, useRef } from \"react\";\nimport generatePayload from 'promptpay-qr';\nimport { QRCodeCanvas } from 'qrcode.react';\nimport Cards from 'react-credit-cards-2';\nimport 'react-credit-cards-2/dist/es/styles-compiled.css';");
}

const targetStr = `                  {isCash ? (
                    <div className="flex flex-col gap-4 flex-1">
                      <div className="flex gap-4">
                        {[100, 500, 1000].map(val => (
                          <button key={val} onClick={() => setPaidAmountStr(val.toString())} className="flex-1 py-4 border rounded-xl text-xl font-bold hover:bg-gray-50 text-black">{val}</button>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 gap-4 flex-1">
                        {["7", "8", "9", "<", "4", "5", "6", "C", "1", "2", "3", "", "00", "0", ".", ""].map((b, i) => (
                          b === "" ? <div key={i}></div> :
                            <button key={i} onClick={() => handleKeypad(b)} className={\`border rounded-xl text-2xl font-bold hover:bg-gray-50 active:bg-gray-100 \${b === "<" || b === "C" ? "text-red-500" : "text-black"}\`}>{b}</button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                      <span className="text-[20px] font-bold text-gray-600 mb-2">ช่องทาง: {paymentMethod}</span>
                      <span className="text-[14px] text-gray-500">ยอดชำระถูกกำหนดให้เต็มจำนวนโดยอัตโนมัติ</span>
                    </div>
                  )}`;

const replaceStr = `                  {isCash ? (
                    <div className="flex flex-col gap-4 flex-1">
                      <div className="flex gap-4">
                        {[100, 500, 1000].map(val => (
                          <button key={val} onClick={() => setPaidAmountStr(val.toString())} className="flex-1 py-4 border rounded-xl text-xl font-bold hover:bg-gray-50 text-black">{val}</button>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 gap-4 flex-1">
                        {["7", "8", "9", "<", "4", "5", "6", "C", "1", "2", "3", "", "00", "0", ".", ""].map((b, i) => (
                          b === "" ? <div key={i}></div> :
                            <button key={i} onClick={() => handleKeypad(b)} className={\`border rounded-xl text-2xl font-bold hover:bg-gray-50 active:bg-gray-100 \${b === "<" || b === "C" ? "text-red-500" : "text-black"}\`}>{b}</button>
                        ))}
                      </div>
                    </div>
                  ) : selectedPaymentConfig?.type === 'QR' ? (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 p-6 text-center">
                        {shopSettings?.promptpay_id ? (
                            <>
                                <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                                    <QRCodeCanvas value={generatePayload(shopSettings.promptpay_id, { amount: totalPrice })} size={200} />
                                </div>
                                <span className="text-[18px] font-bold text-gray-800">สแกน QR เพื่อชำระเงิน</span>
                                <span className="text-[14px] text-gray-500 mt-1">พร้อมเพย์: {shopSettings.promptpay_id}</span>
                            </>
                        ) : (
                            <div className="text-red-500 flex flex-col items-center gap-2">
                                <AlertCircle className="w-8 h-8" />
                                <span>ยังไม่ได้ตั้งค่าพร้อมเพย์ของร้าน</span>
                                <span className="text-sm">กรุณาตั้งค่าในเมนู "ข้อมูลบัญชีรับเงินของร้าน"</span>
                            </div>
                        )}
                    </div>
                  ) : selectedPaymentConfig?.type === 'TRANSFER' ? (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 p-6 text-center">
                         {shopSettings?.bank_account ? (
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm">
                                <h3 className="text-gray-500 text-sm mb-4">ข้อมูลบัญชีสำหรับโอนเงิน</h3>
                                <div className="space-y-4 text-left">
                                    <div>
                                        <p className="text-xs text-gray-400">ธนาคาร</p>
                                        <p className="text-lg font-bold text-gray-800">{shopSettings.bank_name || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">เลขบัญชี</p>
                                        <p className="text-xl font-mono font-bold text-[#7a5c4e]">{shopSettings.bank_account || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">ชื่อบัญชี</p>
                                        <p className="text-md font-bold text-gray-800">{shopSettings.bank_account_name || '-'}</p>
                                    </div>
                                </div>
                            </div>
                         ) : (
                            <div className="text-red-500 flex flex-col items-center gap-2">
                                <AlertCircle className="w-8 h-8" />
                                <span>ยังไม่ได้ตั้งค่าบัญชีธนาคาร</span>
                                <span className="text-sm">กรุณาตั้งค่าในเมนู "ข้อมูลบัญชีรับเงินของร้าน"</span>
                            </div>
                         )}
                    </div>
                  ) : selectedPaymentConfig?.type === 'CARD' ? (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 p-6 text-center">
                        <div className="w-full max-w-md">
                            <Cards number="" name="ลูกค้า POS" expiry="" cvc="" />
                            <div className="mt-6 text-left">
                                <p className="text-sm text-gray-500 mb-2">เชื่อมต่อเครื่องรูดบัตร (EDC) หรือกรอกข้อมูลบัตรเพื่อชำระเงินออนไลน์</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" placeholder="หมายเลขบัตร" className="col-span-2 rounded-xl border border-gray-300 p-3 text-sm" />
                                    <input type="text" placeholder="ด/ป" className="rounded-xl border border-gray-300 p-3 text-sm" />
                                    <input type="text" placeholder="CVC" className="rounded-xl border border-gray-300 p-3 text-sm" />
                                </div>
                            </div>
                        </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                      <span className="text-[20px] font-bold text-gray-600 mb-2">ช่องทาง: {paymentMethod}</span>
                      <span className="text-[14px] text-gray-500">ยอดชำระถูกกำหนดให้เต็มจำนวนโดยอัตโนมัติ</span>
                    </div>
                  )}`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replaceStr);
    fs.writeFileSync(file, content);
    console.log("Updated POS page!");
} else {
    console.log("Could not find the target string.");
}
