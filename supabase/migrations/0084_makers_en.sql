-- 0084: الأسماء الإنجليزية لبعض المصنّعين المكتوبين بالعربية في سجل المواد (لملخص الجدول ودليل المواصفات بالإنجليزية). البقية تُكمل من الإدارة ← الترجمة بعد تأكيد الاسم الرسمي.
insert into public.i18n (k, src, en) values
  ($t$5aac508173ada8538554610ddc802384094744fc7dfe908da54c9b765282161d$t$, $t$الكحيمي$t$, $t$Al Kuhaimi$t$),
  ($t$1aae6116c08da32e2ff294e0c03db02ef6c38b1ce3ab0971a06fa969421eea37$t$, $t$الدريس$t$, $t$Aldrees$t$),
  ($t$ee6f01790ce73e15b12178d930c0b69012b54a16dbefb827426af5aff9cf9422$t$, $t$الفنار$t$, $t$Alfanar$t$),
  ($t$78f93b17c1c83dcb2f62a34234bc8fc244bce7c88857458c0f4365b4d0ea6f1d$t$, $t$الشركة السعودية للمحولات$t$, $t$Saudi Transformers Company$t$),
  ($t$a665cd41b506e2985bd084ba9753b23e8cca9cc1a043af5137a0c0d8f3da536e$t$, $t$كابلات الرياض$t$, $t$Riyadh Cables$t$),
  ($t$4b5b246f6884f3876438c818837d7e88f1795d2070c1bed223f684da714462a4$t$, $t$جوتن$t$, $t$Jotun$t$),
  ($t$34a968acd6e92a854d790d5ed76fe09189e4686a1bad3ccc927ebe39030b8496$t$, $t$الجزيرة$t$, $t$Jazeera Paints$t$),
  ($t$1aec7106e430386cfc31bcf59492cc213b9f3d084190b9a8a77890cc277b712d$t$, $t$همبل$t$, $t$Hempel$t$)
on conflict (k) do nothing;
